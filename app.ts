import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";

// Inicializar el cliente fuera del handler para reutilizar la conexión
const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL;

export const handler = async (event: any[]): Promise<void> => {
    if (!QUEUE_URL) {
        throw new Error("La variable de entorno QUEUE_URL no está definida.");
    }

    const mensajesProcesados: any[] = [];

    // 1. Procesamiento de los datos
    for (const record of event) {
        try {
            const body = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
            
            // Lógica de transformación
            body.fecha_procesamiento = new Date().toISOString();
            body.estado = "PROCESADO";

            console.log(`Item procesado: ${body.id_proceso || 'n/a'}`);
            mensajesProcesados.push(body);
        } catch (error) {
            console.error(`Error al transformar mensaje:`, error);
        }
    }

    // 2. Envío a SQS en bloques (Batching)
    if (mensajesProcesados.length > 0) {
        await enviarBatchASQS(mensajesProcesados);
    }
};

async function enviarBatchASQS(items: any[]) {
    const BATCH_SIZE = 10;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);

        const entries: SendMessageBatchRequestEntry[] = chunk.map((item, index) => ({
            Id: `msg_${i + index}`, // ID único dentro del lote
            MessageBody: JSON.stringify(item)
        }));

        const command = new SendMessageBatchCommand({
            QueueUrl: QUEUE_URL,
            Entries: entries
        });

        try {
            const response = await sqsClient.send(command);
            
            if (response.Failed && response.Failed.length > 0) {
                console.error("Fallaron algunos mensajes en el batch:", response.Failed);
            } else {
                console.log(`Batch enviado con éxito: ${chunk.length} mensajes.`);
            }
        } catch (error) {
            console.error("Error crítico enviando el batch:", error);
        }
    }
}