"""
ドキュメント閲覧用ルーター
"""
import os
import unicodedata
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from config import logger

router = APIRouter(
    prefix="/api/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

DOCUMENTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "documents")

@router.get("/{filename:path}", response_class=PlainTextResponse)
async def get_document(filename: str):
    """
    指定されたMDファイルの内容を返す
    サブディレクトリにも対応
    ファイルが直接見つからない場合は、再帰的に検索する
    """
    # Unicode正規化（NFC形式に統一）
    filename = unicodedata.normalize('NFC', filename)
    
    # ディレクトリトラバーサル対策
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        logger.warning(f"Invalid filename attempt: {filename}")
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    file_path = os.path.join(DOCUMENTS_DIR, filename)
    
    # 正規化してDOCUMENTS_DIR以下にあるか確認
    try:
        common_prefix = os.path.commonpath([os.path.abspath(file_path), os.path.abspath(DOCUMENTS_DIR)])
        if common_prefix != os.path.abspath(DOCUMENTS_DIR):
             logger.warning(f"Path traversal attempt: {file_path}")
             raise HTTPException(status_code=403, detail="Access denied")
    except ValueError:
         # 異なるドライブなどの場合
         raise HTTPException(status_code=403, detail="Access denied")
    
    # ファイルが直接存在しない場合、再帰的に検索
    if not os.path.exists(file_path):
        logger.info(f"File not found at direct path, searching recursively: {filename}")
        # ファイル名のみを抽出して正規化
        basename = unicodedata.normalize('NFC', os.path.basename(filename))
        found_path = None
        
        # DOCUMENTS_DIR以下を再帰的に検索
        for root, dirs, files in os.walk(DOCUMENTS_DIR):
            for file in files:
                # ファイルシステム上のファイル名も正規化して比較
                normalized_file = unicodedata.normalize('NFC', file)
                if normalized_file == basename:
                    candidate_path = os.path.join(root, file)
                    # セキュリティチェック: DOCUMENTS_DIR以下にあることを確認
                    try:
                        common = os.path.commonpath([os.path.abspath(candidate_path), os.path.abspath(DOCUMENTS_DIR)])
                        if common == os.path.abspath(DOCUMENTS_DIR):
                            found_path = candidate_path
                            logger.info(f"Found file at: {found_path}")
                            break
                    except ValueError:
                        continue
            if found_path:
                break
        
        if found_path:
            file_path = found_path
        else:
            logger.warning(f"Document not found even after recursive search: {filename}")
            raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.isfile(file_path):
        logger.warning(f"Path is not a file: {file_path}")
        raise HTTPException(status_code=400, detail="Invalid document path")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        logger.error(f"Error reading document {filename}: {e}")
        raise HTTPException(status_code=500, detail="Error reading document")
