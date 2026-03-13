# This file defines the logging configuration for the Thrifter backend application. It includes a custom StructuredFormatter that formats log records as JSON objects, containing fields such as timestamp, log level, logger name, message, module, function name, and line number. The setup_logging function configures the logging system to use this formatter for console output and sets the logging level based on the provided argument. This structured logging approach allows for easier parsing and analysis of logs, especially when aggregated in log management systems or when debugging issues in production environments. The configuration also ensures that third-party libraries' logs are captured with a simple format for clarity.
import logging
import sys
import json
from datetime import datetime
from typing import Any

class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if they exist
        if hasattr(record, "extra"):
            log_record.update(record.extra)
            
        return json.dumps(log_record)

def setup_logging(level: str = "INFO"):
    logger = logging.getLogger("thrifter")
    logger.setLevel(level)
    
    # Console handler with structured formatting
    handler = logging.StreamHandler(sys.stdout)
    formatter = StructuredFormatter()
    handler.setFormatter(formatter)
    
    # Avoid duplicate handlers
    if not logger.handlers:
        logger.addHandler(handler)
        
    # Also configure root logger for third-party libs but keep it simple
    logging.basicConfig(level=level, handlers=[logging.StreamHandler(sys.stdout)])
    
    return logger
