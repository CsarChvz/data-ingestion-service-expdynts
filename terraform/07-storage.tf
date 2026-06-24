resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_prefix}-terraform-state"
}

resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project_prefix}-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute { 
        name = "LockID" 
        type = "S" 
    }
}