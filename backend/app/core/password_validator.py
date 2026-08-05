import re
from typing import Tuple, List


class PasswordStrength:
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


def validate_password_strength(password: str) -> Tuple[str, List[str], bool]:
    issues = []
    score = 0
    
    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")
    else:
        score += 1
        
    if not re.search(r'[A-Z]', password):
        issues.append("Password must contain at least one uppercase letter")
    else:
        score += 1
        
    if not re.search(r'[a-z]', password):
        issues.append("Password must contain at least one lowercase letter")
    else:
        score += 1
        
    if not re.search(r'\d', password):
        issues.append("Password must contain at least one number")
    else:
        score += 1
        
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        issues.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>")
    else:
        score += 1
        
    common_passwords = [
        'password', '123456', '12345678', 'qwerty', 'abc123', 
        'password123', '123456789', '12345', '1234567', 'password1'
    ]
    if password.lower() in common_passwords:
        issues.append("Password is too common. Please choose a more unique password")
        score = 0
        
    # Check for sequential characters (only 3+ consecutive in a row)
    sequential_patterns = [
        '012', '123', '234', '345', '456', '567', '678', '789', '890',
        'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk',
        'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst',
        'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz'
    ]
    found_sequential = False
    for pattern in sequential_patterns:
        if pattern in password.lower():
            found_sequential = True
            break
    
    if found_sequential:
        issues.append("Avoid using sequential characters")
        score = max(0, score - 1)
        
    if re.search(r'(.)\1{2,}', password):
        issues.append("Avoid using repeated characters")
        score = max(0, score - 1)
    
    if score >= 5:
        strength = PasswordStrength.VERY_STRONG
    elif score >= 4:
        strength = PasswordStrength.STRONG
    elif score >= 3:
        strength = PasswordStrength.MODERATE
    else:
        strength = PasswordStrength.WEAK
        
    is_valid = len(issues) == 0 or (score >= 4 and len(issues) <= 1)
    
    return strength, issues, is_valid


def get_password_requirements() -> List[str]:
    return [
        "At least 8 characters long",
        "Contains uppercase letter (A-Z)",
        "Contains lowercase letter (a-z)",
        "Contains number (0-9)",
        "Contains special character (!@#$%^&*(),.?\":{}|<>"
        "Not a common password"
    ]

