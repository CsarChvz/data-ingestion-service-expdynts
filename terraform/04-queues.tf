resource "aws_sqs_queue" "cola_origen" {
  name = var.cola_origen
}

resource "aws_sqs_queue" "cola_destino" {
  name = var.cola_destino
}