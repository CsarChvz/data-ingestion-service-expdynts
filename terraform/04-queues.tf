resource "aws_sqs_queue" "cola_origen" {
  name = "cola-origen"
}

resource "aws_sqs_queue" "cola_destino" {
  name = "cola-destino"
}