#!/usr/bin/env python3
"""Add shop_crm to the hosted Supabase Data API without linking this checkout."""

import argparse
import getpass
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PROJECT_REF = "jkdncdexqcymwbihwdhp"
CONFIG_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/postgrest"


def add_schema(current: str) -> str:
    schemas = [schema.strip() for schema in current.split(",") if schema.strip()]
    if "shop_crm" not in schemas:
        schemas.append("shop_crm")
    return ",".join(schemas)


def request_config(token: str, method: str = "GET", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = Request(
        CONFIG_URL,
        method=method,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="save the updated setting")
    args = parser.parse_args()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or getpass.getpass(
        "Supabase personal access token for the Building Suit project: "
    )
    if not token:
        print("A personal access token is required.", file=sys.stderr)
        return 2

    try:
        current = request_config(token)
        current_schemas = current.get("db_schema")
        if not isinstance(current_schemas, str) or not current_schemas.strip():
            raise ValueError("Management API did not return db_schema; no change made")

        proposed = add_schema(current_schemas)
        print(f"Project: {PROJECT_REF}")
        print(f"Current exposed schemas: {current_schemas}")
        print(f"Proposed exposed schemas: {proposed}")
        if "shop_crm" in [
            schema.strip() for schema in current_schemas.split(",")
        ]:
            print("shop_crm is already configured; no change needed.")
            return 0
        if not args.apply:
            print("Dry run only. Add --apply to save this setting.")
            return 0

        request_config(token, method="PATCH", body={"db_schema": proposed})
        for _ in range(10):
            saved = request_config(token)
            schemas = saved.get("db_schema", "")
            if "shop_crm" in [schema.strip() for schema in schemas.split(",")]:
                print(f"Saved exposed schemas: {schemas}")
                return 0
            time.sleep(1)
        raise RuntimeError("The setting was submitted but could not be verified")
    except HTTPError as error:
        print(
            f"Supabase Management API returned HTTP {error.code}. "
            "Use a personal access token from an account with Data API config access "
            "to this project; a service-role key will not work.",
            file=sys.stderr,
        )
        return 1
    except (URLError, ValueError, RuntimeError) as error:
        print(f"Unable to update Data API setting: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
