import sys

def app(environ, respond):
    respond("200 OK", [("Content-Type", "text/plain")])
    lines = []
    lines.append("Hello from Python!")
    lines.append(repr(sys.path))
    try:
        import openpyxl
        lines.append(repr(openpyxl))
    except Exception as ex:
        lines.append(repr(ex))
    return ["\n".join(lines).encode("utf-8")]
