from __future__ import annotations

import argparse
from concurrent.futures import Future, ThreadPoolExecutor
from os.path import abspath
from subprocess import CalledProcessError, run
from typing import Sequence

from tools.lib import gitroot


def worker(args: tuple[str, ...]) -> None:
    # pip-compile doesn't let you customize the header, so we write
    # one ourselves. However, pip-compile needs -o DEST otherwise
    # it will bump >= pins even if they're satisfied. So, we need to
    # unfortunately rewrite the whole file.
    dest = args[-1]
    try:
        run(args, check=True, capture_output=True)
    except CalledProcessError as e:
        raise e

    with open(dest, "rb+") as f:
        content = f.read()
        f.seek(0, 0)
        f.write(
            b"""# DO NOT MODIFY. This file was generated with `make freeze-requirements`.

"""
            + content
        )


def check_futures(futures: list[Future[None]]) -> int:
    rc = 0
    for future in futures:
        try:
            future.result()
        except CalledProcessError as e:
            rc = 1
            print(
                f"""`{e.cmd}` returned code {e.returncode}

stdout:
{e.stdout.decode()}

stderr:
{e.stderr.decode()}
"""
            )
    return rc


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args(argv)

    base_path = abspath(gitroot())

    base_cmd = (
        "pip-compile",
        "--allow-unsafe",
        "--no-annotate",
        "--no-header",
        "--quiet",
        "--strip-extras",
        "--index-url=https://pypi.devinfra.sentry.io/simple",
    )

    executor = ThreadPoolExecutor(max_workers=2)
    futures = [
        executor.submit(
            worker,
            (
                *base_cmd,
                f"{base_path}/requirements-base.txt",
                f"{base_path}/requirements-getsentry.txt",
                "-o",
                f"{base_path}/requirements-frozen.txt",
            ),
        ),
        executor.submit(
            worker,
            (
                *base_cmd,
                f"{base_path}/requirements-base.txt",
                f"{base_path}/requirements-getsentry.txt",
                f"{base_path}/requirements-dev.txt",
                "-o",
                f"{base_path}/requirements-dev-frozen.txt",
            ),
        ),
    ]

    rc = check_futures(futures)
    executor.shutdown()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
