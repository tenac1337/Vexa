from flask import Blueprint, request, jsonify
import threading
import time
import subprocess
import platform

bp = Blueprint('tool_opener', __name__)

TOOL_URLS = {
    "gmail": "https://mail.google.com/",
    "calendar": "https://calendar.google.com/",
    "notion": "https://www.notion.so/",
    "tasks": "https://tasks.google.com/tasks/"
}

def open_and_close_tool(url, duration, result):
    try:
        if platform.system() != "Darwin":
            result['error'] = "This feature is only supported on macOS."
            result['status'] = 'error'
            print("[Thread] Not running on macOS, aborting.")
            return

        print(f"[Thread] Opening {url} in Google Chrome for {duration} seconds using AppleScript...")

        # AppleScript to open a new tab with the URL
        open_tab_script = f'''
        tell application "Google Chrome"
            if not (exists window 1) then
                make new window
            end if
            tell window 1
                set newTab to make new tab at end of tabs with properties {{URL:"{url}"}}
                set active tab index to (count of tabs)
            end tell
            activate
        end tell
        '''
        subprocess.run(['osascript', '-e', open_tab_script])

        time.sleep(duration)

        # AppleScript to close the rightmost tab (the one we just opened)
        close_tab_script = '''
        tell application "Google Chrome"
            if (count of windows) > 0 then
                tell window 1
                    if (count of tabs) > 0 then
                        close tab (count of tabs)
                    end if
                end tell
            end if
        end tell
        '''
        subprocess.run(['osascript', '-e', close_tab_script])

        result['status'] = 'closed'
        print("[Thread] Tab closed successfully with AppleScript.")
    except Exception as e:
        error_message = str(e)
        result['error'] = error_message
        result['status'] = 'error'
        print(f"[Thread] An unexpected error occurred: {error_message}")

@bp.route('/api/open-tool', methods=['POST'])
def open_tool():
    data = request.json
    tool = data.get('tool')
    duration = int(data.get('duration', 60))
    url = TOOL_URLS.get(tool)
    if not url:
        return jsonify({"error": "Invalid tool"}), 400

    result = {'status': 'opening'}
    thread = threading.Thread(target=open_and_close_tool, args=(url, duration, result))
    thread.start()

    return jsonify({"status": "Process started to open tool", "tool": tool, "duration": duration})
