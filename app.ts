/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import { db } from './db.js';
import { expedientes, usuarioExpedientes } from './schema.js';
import { eq } from 'drizzle-orm';

const CONFIG = {
    AWS_REGION: 'us-east-1',
    QUEUE_URL: process.env.QUEUE_URL || '',
    BATCH_SIZE: 10,
} as const;

const sqsClient = new SQSClient({ region: CONFIG.AWS_REGION });

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    console.log(`📦 Iniciando proceso automático de extracción`);

    try {
        if (!CONFIG.QUEUE_URL) {
            return createErrorResponse(400, 'QUEUE_URL no configurado');
        }

        // 1. Obtener registros
        const registros =  await db
            .select(
                {       
                    expedienteId: usuarioExpedientes.expedienteId,
                    usuarioExpedientesId: usuarioExpedientes.usuarioExpedientesId,
                    expediente: {
                        url: expedientes.url
                    }
                }
            )
            .from(usuarioExpedientes)
            .innerJoin(expedientes, eq(usuarioExpedientes.expedienteId, expedientes.expedienteId))
        
        if (registros.length === 0) {
            console.log("✅ No hay registros pendientes para procesar.");
            return createSuccessResponse({ message: "Nada pendiente" });
        }

        // 2. Transformación
        const registrosProcesados = registros.map(item => ({
            ...item,
            id: `exp-${item.expedienteId}`,
            fecha_procesamiento: new Date().toISOString(),
            estado: "PROCESADO"
        }));

        // 3. Envío a SQS
        const report = await enviarRegistrosASQS(registrosProcesados);

        return createSuccessResponse({ message: "Proceso completado", report });

    } catch (error) {
        console.error(`💥 Error crítico:`, error);
        return createErrorResponse(500, 'Error interno', { error: String(error) });
    }
};

async function enviarRegistrosASQS(items: any[]): Promise<{ exitosos: number, fallidos: number }> {
    const report = { exitosos: 0, fallidos: 0 };

    for (let i = 0; i < items.length; i += CONFIG.BATCH_SIZE) {
        const chunk = items.slice(i, i + CONFIG.BATCH_SIZE);
        
        const entries: SendMessageBatchRequestEntry[] = chunk.map((item, index) => ({
            Id: `msg_${i + index}`,
            MessageBody: JSON.stringify(item)
        }));

        try {
            await sqsClient.send(new SendMessageBatchCommand({
                QueueUrl: CONFIG.QUEUE_URL,
                Entries: entries
            }));
            report.exitosos += chunk.length;
        } catch (error) {
            console.error("Error enviando bloque a SQS:", error);
            report.fallidos += chunk.length;
        }
    }
    return report;
}

function createSuccessResponse(data: any): APIGatewayProxyResult {
    return { statusCode: 200, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } };
}

function createErrorResponse(statusCode: number, message: string, extra?: any): APIGatewayProxyResult {
    return { statusCode, body: JSON.stringify({ message, ...extra }), headers: { 'Content-Type': 'application/json' } };
}