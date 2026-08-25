"""CLI shim: python -m crawler.export"""
from crawler.exchange.export import main

if __name__ == "__main__":
    raise SystemExit(main())
