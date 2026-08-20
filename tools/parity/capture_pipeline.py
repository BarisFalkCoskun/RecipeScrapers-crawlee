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


class CaptureJsonPipeline:
    def open_spider(self, spider):
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
