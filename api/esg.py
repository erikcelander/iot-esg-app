import sys, os


def serve_request(input_stream):
    request_body = input_stream.read()
    print(f"Read {len(request_body)} bytes from request body.")
    print(repr(request_body))
    return [request_body]


def cli_main():
    # Redirect stdout to stderr and reserve stdout for data.
    out = os.fdopen(os.dup(sys.stdout.fileno()), "wb")
    os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

    input_stream = sys.stdin.detach()

    result = serve_request(input_stream)
    for chunk in result:
        out.write(chunk)


def app(environ, respond):
    result = serve_request(environ["wsgi.input"])
    respond("200 OK", [("Content-Type", "text/plain")])
    return result


if __name__ == "__main__":
    cli_main()
