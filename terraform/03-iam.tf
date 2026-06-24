# Rol para la Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.service_prefix}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      },
      
    ]
  })
}

# Crear política para CloudWatch Logs
resource "aws_iam_policy" "cloudwatch_logs_policy" {
  name        = "${var.service_prefix}-cloudwatch-policy"
  description = "Permite escribir logs en CloudWatch"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Adjuntar la política de logs al rol
resource "aws_iam_role_policy_attachment" "cloudwatch_logs_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.cloudwatch_logs_policy.arn
}


# Politica para SQS - Enviar mensajes
resource "aws_iam_policy" "sqs_send_policy" {
  name        = "${var.service_prefix}-sqs-send-policy"
  description = "Permite enviar mensajes a la cola SQS"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "sqs:SendMessage",
          "sqs:SendMessageBatch"
        ]
        Resource = [aws_sqs_queue.cola_origen.arn]
      }
    ]
  })
}

# Adjuntamos la politica al rol de la lambda
resource "aws_iam_role_policy_attachment" "sqs_send_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.sqs_send_policy.arn
}