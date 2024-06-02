import sys, os


def serve_request():
    return [b"Hello from Python!", b"\n"]


def cli_main():
    # Redirect stdout to stderr and reserve stdout for data.
    out = os.fdopen(os.dup(sys.stdout.fileno()), "wb")
    os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

    result = serve_request()
    for chunk in result:
        out.write(chunk)


def app(environ, respond):
    result = serve_request()
    respond("200 OK", [("Content-Type", "text/plain")])
    return result


if __name__ == "__main__":
    cli_main()
