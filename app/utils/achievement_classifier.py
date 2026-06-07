# Simple AI-based achievement classifier
# This is a placeholder for a real ML/NLP model. Replace with a proper model as needed.


# Expanded categories and keywords for both achievements and activities
CATEGORY_KEYWORDS = {
    "Hackathon": ["hackathon", "codefest", "coding marathon"],
    "Technical": ["tech", "technical", "programming", "software", "hardware", "robotics", "ai", "ml", "data science", "python", "java", "c++", "web", "app", "development", "cloud", "blockchain"],
    "Soft Skill": ["leadership", "communication", "presentation", "teamwork", "soft skill", "public speaking", "debate"],
    "Sports": ["sports", "football", "cricket", "basketball", "athletics", "tournament", "badminton", "tennis", "volleyball", "kabaddi", "run", "marathon"],
    "Academic": ["academic", "exam", "olympiad", "scholarship", "gpa", "cgpa", "marks", "result", "merit"],
    "Cultural": ["cultural", "music", "dance", "art", "drama", "theatre", "festival", "singing", "painting", "drawing", "instrument", "band", "performance"],
    "Research": ["research", "paper", "journal", "conference", "publication", "poster", "thesis", "dissertation"],
    "Certification": ["certification", "certificate", "course", "training", "workshop", "seminar", "bootcamp"],
    "Internship": ["internship", "intern", "industrial training", "placement"],
    "Workshop": ["workshop", "hands-on", "lab", "practical"],
    "Volunteering": ["volunteer", "ngo", "social work", "community", "service", "blood donation", "cleanliness"],
    "Club": ["club", "society", "association", "group"],
    "Other": []
}

DEFAULT_CATEGORY = "Other"

def classify_achievement(text):
    text = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return DEFAULT_CATEGORY
