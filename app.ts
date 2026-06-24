/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import { db } from './db.js';
import { expedientes, usuarioExpedientes } from './schema.js';
import { eq } from 'drizzle-orm';

const CONFIG = {
    AWS_REGION: 'us-east-1',
    QUEUE_URL: process.env.QUEUE_URL || '',
    BATCH_SIZE: 10, // Máximo permitido por SQS
} as const;

const sqsClient = new SQSClient({ region: CONFIG.AWS_REGION });

type BatchInfo = {
    batchId: string;
    offset: number;
    limit: number;
    totalRecords: number;
    batchNumber: number;
    totalBatches: number;
};

type ProcessingResult = {
    success: boolean;
    usuarioExpedientesId?: number;
    error?: string;
};

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const requestId = event.requestContext?.requestId || 'unknown';

    console.log(`📦 [${requestId}] Iniciando proceso de extracción y encolado`);

    try {
        if (!CONFIG.QUEUE_URL) {
            return createErrorResponse(400, 'QUEUE_URL no configurado');
        }

        const batchInfo = await parseBatchInfo(event.body);
        if (!batchInfo) {
            return createErrorResponse(400, 'Batch info inválido o faltante');
        }

        // 1. Obtener registros de la BD
        const registros = await fetchBatchRecords(batchInfo);
        
        if (registros.length === 0) {
            return createSuccessResponse({ message: "No hay registros para procesar", processed: 0 });
        }

        // 2. Transformación de datos
        const registrosProcesados = registros.map(item => ({
            ...item,
            id: `exp-${item.expedienteId}`,
            fecha_procesamiento: new Date().toISOString(),
            estado: "PROCESADO"
        }));

        // 3. Envío a SQS
        const resultados = await enviarRegistrosASQS(registrosProcesados);

        const responseData = {
            batchId: batchInfo.batchId,
            totalEnviados: registrosProcesados.length,
            resultados
        };

        console.log(`✅ [${requestId}] Proceso finalizado con éxito`);
        return createSuccessResponse(responseData);

    } catch (error) {
        console.error(`💥 [${requestId}] Error crítico:`, error);
        return createErrorResponse(500, 'Error interno del servidor', { error: String(error) });
    }
};

async function fetchBatchRecords(batchInfo: BatchInfo) {
    try {
        return await db
            .select({
                expedienteId: usuarioExpedientes.expedienteId,
                usuarioExpedientesId: usuarioExpedientes.usuarioExpedientesId,
                expediente: { url: expedientes.url }
            })
            .from(usuarioExpedientes)
            .innerJoin(expedientes, eq(usuarioExpedientes.expedienteId, expedientes.expedienteId))
            .limit(batchInfo.limit)
            .offset(batchInfo.offset);
    } catch (error) {
        throw new Error(`Error en DB: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
}

async function enviarRegistrosASQS(items: any[]): Promise<any> {
    const report = { exitosos: 0, fallidos: 0 };

    for (let i = 0; i < items.length; i += CONFIG.BATCH_SIZE) {
        const chunk = items.slice(i, i + CONFIG.BATCH_SIZE);
        
        const entries: SendMessageBatchRequestEntry[] = chunk.map((item, index) => ({
            Id: `msg_${i + index}`,
            MessageBody: JSON.stringify(item)
        }));

        try {
            const command = new SendMessageBatchCommand({
                QueueUrl: CONFIG.QUEUE_URL,
                Entries: entries
            });
            
            await sqsClient.send(command);
            report.exitosos += chunk.length;
        } catch (error) {
            console.error("Error enviando bloque a SQS:", error);
            report.fallidos += chunk.length;
        }
    }
    return report;
}

async function parseBatchInfo(body: string | null): Promise<BatchInfo | null> {
    if (!body) return null;
    try {
        const parsed = JSON.parse(body);
        return (parsed.batchId && typeof parsed.offset === 'number') ? parsed : null;
    } catch { return null; }
}

function createSuccessResponse(data: any): APIGatewayProxyResult {
    return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } };
}

function createErrorResponse(statusCode: number, message: string, extra?: any): APIGatewayProxyResult {
    return { statusCode, body: JSON.stringify({ message, ...extra }), headers: { 'Content-Type': 'application/json' } };
}