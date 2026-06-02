from typing import TypedDict, Optional

class MonetizationState(TypedDict):
    # Scout Node からセットされる
    champion: str
    meta_context: str
    
    # Writer Node からセットされる
    draft_article: str
    
    # Auditor Node からセットされる
    audit_feedback: str
    audit_passed: bool
    audit_count: int
    
    # Publisher Node からセットされる
    x_thread_json: str
    publish_status: str
