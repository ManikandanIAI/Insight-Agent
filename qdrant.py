import os
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
import asyncio
from langchain.embeddings.base import Embeddings 

import hashlib
from dotenv import dotenv_values

# Initialize Qdrant and embeddings
env_vars = dotenv_values('.env')
openai_api_key = env_vars.get('OPENAI_API_KEY')
QDRANT_CLIENT_URL = env_vars.get('QDRANT_CLIENT_URL')
embeddings = OpenAIEmbeddings(api_key=openai_api_key)
qdrant_client = QdrantClient(host=QDRANT_CLIENT_URL, port=6333)

# Ensure the collection exists (run this only once or check first)
try:
    qdrant_client.get_collection("file_storage")
except Exception:
    qdrant_client.create_collection(
        collection_name="file_storage",
        vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    )

async def store_document_embeddings(file_id, filename, text_content, user_id):
    try:
        # Generate SHA-256 hash of the document content
        content_hash = hashlib.sha256(text_content.encode('utf-8')).hexdigest()
        print(f"Document hash: {content_hash}")
        
        # Check if document with this hash already exists
        qdrant = Qdrant(
            client=qdrant_client,
            collection_name="file_storage",
            embeddings=embeddings
        )
        
        # Search for existing document with same hash
        try:
            existing_docs = qdrant.similarity_search(
                query="dummy_query",  # We just need to check metadata, query doesn't matter
                k=1,
                filter={"content_hash": content_hash, "user_id": user_id}
            )
            
            if existing_docs:
                print(f"Document with hash {content_hash} already exists")
                return {
                    "status": "success", 
                    "message": "Document already exists",
                    "file_id": existing_docs[0].metadata.get("file_id"),
                    "existing_filename": existing_docs[0].metadata.get("filename"),
                    "content_hash": content_hash
                }
        except Exception as search_error:
            # If search fails, assume document doesn't exist and continue
            print(f"Search error (continuing with storage): {search_error}")
        
        # Document doesn't exist, proceed with storage
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Split the text into chunks
        texts = text_splitter.split_text(text_content)
        print(f"Number of chunks created: {len(texts)}")
        
        # Create metadata for each chunk (including content hash)
        metadatas = [
            {
                "file_id": file_id,
                "user_id": user_id,
                "filename": filename,
                "chunk_index": i,
                "total_chunks": len(texts),
                "content_hash": content_hash  # Add hash to metadata
            } for i in range(len(texts))
        ]
        
        # Convert to LangChain documents
        documents = [
            Document(page_content=text, metadata=metadata)
            for text, metadata in zip(texts, metadatas)
        ]
        
        # Add documents to Qdrant
        # This will be executed in a thread pool since it's a blocking operation
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: qdrant.add_documents(documents)
        )
        
        return {
            "status": "success", 
            "chunks": len(texts),
            "content_hash": content_hash,
            "message": "Document stored successfully",
            "file_id": file_id
        }
    
    except Exception as e:
        print(f"Error storing embeddings: {str(e)}")
        return {"status": "error", "message": str(e)}


def search_file_storage(query: str, doc_ids: list, k: int = 5):
    """
    Perform a similarity search on the 'file_storage' collection in Qdrant for a given query and session ID.

    Args:
        query (str): The query string to search.
        session_id (str): The session ID to filter the search.
        qdrant_client (QdrantClient): The Qdrant client instance.
        embeddings (Embeddings): The embeddings model used for vector representation.
        k (int): Number of top results to retrieve.

    Returns:
        List[Dict]: A list of dictionaries containing search results.
    """
    qdrant = Qdrant(
        client=qdrant_client,
        collection_name="file_storage",
        embeddings=embeddings
    )

    results = qdrant.similarity_search(
        query=query,
        k=k,
        filter={"file_id": doc_ids}
    )
    print(results)
    print("................................")
    formatted_results = []
    for doc in results:
        result_data = {
            "content": doc.page_content,
            "filename": doc.metadata.get("filename"),
            "file_id": doc.metadata.get("file_id")
        }
        formatted_results.append(result_data)

    return formatted_results

if __name__ == "__main__":
    x = search_file_storage("GST Taxation in India", ["62a48b96-f03f-4576-a07a-b9a011d19d21"], k=5)
    print(x)