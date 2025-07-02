from datetime import datetime, timezone

# Paths or filenames for logs and outputs can also be defined here
def get_log_file_path():
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"graph_logs/{timestamp}_deepResearch_logs_.txt"

def final_output_file_path():
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"external_data/{timestamp}_deepResearch_detailed_report.json"

def append_log_to_txt(log_data: str, stage: str, logs_file_path: str):
    timestamp_str = datetime.now(timezone.utc).isoformat()
    header = f"----- {stage} at {timestamp_str} -----\n"
    body = log_data + "\n\n"
    with open(logs_file_path, "a") as f:
        f.write(header)
        f.write(body)
        f.flush()

def log_function(func):
    """Decorator to log function calls, inputs, outputs, and exceptions."""
    def wrapper(*args, **kwargs):
        logs_file_path = get_log_file_path()
        try:
            result = func(*args, **kwargs)
            log_entry = f"Called with args={args}, kwargs={kwargs} | Returned: {result}"
            append_log_to_txt(log_entry, func.__name__, logs_file_path)
            return result
        except Exception as e:
            log_entry = f"Called with args={args}, kwargs={kwargs} | Raised Exception: {e}"
            append_log_to_txt(log_entry, func.__name__, logs_file_path)
            raise
    return wrapper