data "aws_sqs_queue" "existente" {
  name = "${variables.cola-origen}"
}

resource "aws_sqs_queue" "cola_origen" {
  count = length(data.aws_sqs_queue.existente.arn) > 0 ? 0 : 1
  
  name = "${variables.cola-origen}"
}

locals {
  arn_cola_origen = length(data.aws_sqs_queue.existente.arn) > 0 ? data.aws_sqs_queue.existente.arn : aws_sqs_queue.cola_destino[0].arn
}