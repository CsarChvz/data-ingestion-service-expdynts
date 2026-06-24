resource "aws_cloudwatch_event_rule" "daily_execution" {
  name                = "${var.project_prefix}-daily-rule"
  description         = "Ejecuta la lambda todos los días a las 09:10 UTC"
  schedule_expression = "cron(10 9 * * ? *)" 
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.daily_execution.name
  target_id = "TriggerLambda"
  arn       = module.lambda_function.lambda_function_arn
}

