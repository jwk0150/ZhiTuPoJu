"""CLI shim: python -m crawler.merge"""
from crawler.exchange.merge import main

if __name__ == "__main__":
    raise SystemExit(main())
