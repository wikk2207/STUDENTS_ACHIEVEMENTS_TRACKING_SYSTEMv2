"""Server-side voice command hints and API responses."""

VOICE_COMMANDS = {
    "landing": ["login", "register me", "send otp", "turn voice off"],
    "navigation": [
        "open dashboard",
        "open student dashboard",
        "open mentor dashboard",
        "add achievement",
        "add activity",
        "go to achievements",
        "go to activities",
        "open reports",
        "open submissions",
        "logout",
        "go back",
        "go home",
        "open analytics",
        "open notifications",
        "open profile",
        "open leaderboard",
    ],
    "auth": [
        "login",
        "register me",
        "login with otp",
        "send otp to my email",
        "verify otp 123456",
    ],
    "forms": [
        "set title to",
        "set category to",
        "set event name to",
        "set activity name to",
        "set date to",
        "set rank to",
        "set description to",
        "set organizer to",
        "set level to",
        "fill from certificate",
        "submit form",
        "save draft",
        "clear form",
    ],
    "files": [
        "upload certificate",
        "open file manager",
        "open file picker",
        "upload the selected file",
        "attach the selected document",
        "find certificate named",
    ],
    "mentor": [
        "approve submission",
        "reject submission",
        "add comment",
        "next submission",
        "read ocr",
        "filter by technical",
    ],
    "utility": [
        "turn voice off",
        "turn voice on",
        "read this page",
        "help",
        "what can you do",
        "stop speaking",
        "repeat that",
        "scroll down",
        "scroll to top",
        "enable dark mode",
        "disable dark mode",
    ],
}


def get_help_text():
    lines = ["Voice assistant commands:"]
    for category, cmds in VOICE_COMMANDS.items():
        lines.append(f"{category.title()}: " + ", ".join(cmds[:6]) + "...")
    return " ".join(lines)
