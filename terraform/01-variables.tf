variable "aws_region" {
  description = "Región de AWS para el laboratorio"
  type        = string
  default     = "us-east-1"
}

variable "project_prefix" {
  description = "Prefijo para identificar los recursos"
  type        = string
  default     = "data-ingestion-service-expdynts"
}

variable "cola-origen" {
  description = "Nombre de la cola origen a donde se meteran los datos"
  type        = string
  default     = "cola-origen"
}


variable "database_url" {
  description = "URL de conexión a la base de datos"
  type        = string
  sensitive   = true
}