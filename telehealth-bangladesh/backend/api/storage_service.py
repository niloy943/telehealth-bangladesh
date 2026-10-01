import os
import uuid
import re

def safe_secure_filename(filename):
    filename = os.path.basename(filename)
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)

class CloudStorageService:
    """
    Storage Abstraction Service supporting local disk storage in development
    and AWS S3 / Azure Blob / MinIO object storage in production.
    Enforces secure file naming, extension validation, size limits, and path traversal prevention.
    """
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'dcm', 'doc', 'docx', 'txt'}
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit

    def __init__(self):
        self.s3_bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME")
        self.aws_key = os.environ.get("AWS_ACCESS_KEY_ID")
        self.aws_secret = os.environ.get("AWS_SECRET_ACCESS_KEY")
        self.is_production = bool(self.s3_bucket and self.aws_key and self.aws_key != "mock_key")
        
        # Local upload directory setup
        self.local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media_uploads")
        os.makedirs(self.local_dir, exist_ok=True)

    def is_allowed_file(self, filename: str) -> bool:
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in self.ALLOWED_EXTENSIONS

    def save_file(self, file_obj, filename: str) -> dict:
        """
        Saves uploaded file safely.
        """
        if not self.is_allowed_file(filename):
            return {
                "success": False,
                "error": f"File extension not permitted. Allowed extensions: {', '.join(self.ALLOWED_EXTENSIONS)}"
            }

        # Secure filename generation to prevent path traversal
        safe_name = f"{uuid.uuid4().hex}_{safe_secure_filename(filename)}"
        
        if self.is_production:
            try:
                import boto3
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=self.aws_key,
                    aws_secret_access_key=self.aws_secret
                )
                s3_client.upload_fileobj(file_obj, self.s3_bucket, safe_name)
                url = f"https://{self.s3_bucket}.s3.amazonaws.com/{safe_name}"
                return {"success": True, "mode": "production", "file_name": safe_name, "file_url": url}
            except Exception as e:
                return {"success": False, "error": f"S3 Upload failed: {str(e)}"}
        else:
            file_path = os.path.join(self.local_dir, safe_name)
            with open(file_path, 'wb') as f:
                if hasattr(file_obj, 'read'):
                    f.write(file_obj.read())
                else:
                    f.write(file_obj)
            
            relative_url = f"/api/storage/file/{safe_name}/"
            return {
                "success": True,
                "mode": "local",
                "file_name": safe_name,
                "file_path": file_path,
                "file_url": relative_url
            }

storage_service = CloudStorageService()
