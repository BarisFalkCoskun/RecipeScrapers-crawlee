"""Capture-only item pipeline for isolated parity runs.

Scrapy's feed exporter enumerates every spider attribute to build its URI
params, which raises AttributeError: __provides__ on the browser-backed
spiders, so `-O file.json` produces nothing for them. Writing the items from a
pipeline avoids the exporter entirely and keeps the run side-effect free: this
replaces the production pipelines rather than running alongside them.

Items are written as JSON Lines and flushed per item. A run that is killed —
by the harness timeout, or by anything else — then leaves a file that is still
readable up to the last complete line, instead of a truncated JSON array that
cannot be parsed at all.
"""
import json
import os

from itemadapter import ItemAdapter
from scrapy import signals


class CaptureJsonPipeline:
    def open_spider(self, spider):
        # close_spider runs before the engine records why the crawl ended, so a
        # pipeline that writes stats there always reports finish_reason None -
        # and that is the field the legacy-unhealthy route turns on, since a
        # blocked run reporting "finished" is the whole finding. The
        # spider_closed signal carries the reason, so take it from there.
        try:
            spider.crawler.signals.connect(self._record, signal=signals.spider_closed)
        except Exception:  # a crawler without signals is not a failure
            pass
        path = os.environ["PARITY_CAPTURE_PATH"]
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        self.file = open(path, "w", encoding="utf-8")

    def process_item(self, item, spider):
        record = ItemAdapter(item).asdict()
        self.file.write(json.dumps(record, ensure_ascii=False, default=str))
        self.file.write("\n")
        self.file.flush()
        return item

    def close_spider(self, spider):
        self.file.close()

    # The harness runs Scrapy at LOG_LEVEL=WARNING, which suppresses the closing
    # stats dump - so a run that stopped early left no record of
    # item_scraped_count, finish_reason or the response status counts, and a halt
    # could not be told from a complete crawl without running the whole thing
    # again. Write the stats beside the capture instead of raising the log level,
    # which would bury the run in per-request lines.
    def _record(self, spider, reason):
        try:
            stats = dict(spider.crawler.stats.get_stats())
        except Exception:  # a spider without a stats collector is not a failure
            return
        stats.setdefault("finish_reason", reason)
        path = os.environ["PARITY_CAPTURE_PATH"]
        base = path[: -len(".json")] if path.endswith(".json") else path
        with open(base + ".stats.json", "w", encoding="utf-8") as handle:
            json.dump(
                {str(key): value for key, value in stats.items()},
                handle,
                ensure_ascii=False,
                default=str,
            )
