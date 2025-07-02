import re


def validate_password_strength(password: str):
    """
    Validates the strength of a password based on several criteria.
    """
    if len(password) < 8:
        raise ValueError('Password must be at least 8 characters long')
    
    if ' ' in password:
        raise ValueError('Password cannot contain spaces')
        
    if not re.search(r'[a-z]', password):
        raise ValueError('Password must contain at least one lowercase letter')
        
    if not re.search(r'[A-Z]', password):
        raise ValueError('Password must contain at least one uppercase letter')
        
    if not re.search(r'\d', password):
        raise ValueError('Password must contain at least one number')
        
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise ValueError('Password must contain at least one special character')
            
    return password
