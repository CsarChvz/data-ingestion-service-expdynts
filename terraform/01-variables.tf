variable "aws_region" {
  description = "Región de AWS para el laboratorio"
  type        = string
  default     = "us-east-1"
}

variable "service_prefix" {
  description = "Prefijo para identificar los recursos"
  type        = string
  default     = "data-ingestion-service-expdynts"
}

variable "cola_origen" {
  description = "Nombre de la cola origen a donde se meteran los datos"
  type        = string
  default     = "cola-origen"
}

variable "cola_destino" {
  description = "Nombre de la cola destino a donde se meteran los datos"
  type        = string
  default     = "cola-destino"
}

data "aws_ssm_parameter" "db_url" {
  name = "/config/database_url"
}