def app(environ, respond):
    respond("200 OK", [("Content-Type", "text/plain")])
    return [b"Hello from Python!"]
