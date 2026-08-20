"""Capture-only item pipeline for isolated parity runs.

Scrapy's feed exporter enumerates every spider attribute to build its URI
params, which raises AttributeError: __provides__ on the browser-backed
spiders, so `-O file.json` produces nothing for them. Writing the items from a
pipeline avoids the exporter entirely and keeps the run side-effect free: this
replaces the production pipelines rather than running alongside them.
"""
import json
import os

from itemadapter import ItemAdapter


class CaptureJsonPipeline:
    def open_spider(self, spider):
        path = os.environ["PARITY_CAPTURE_PATH"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.file = open(path, "w", encoding="utf-8")
        self.first = True
        self.file.write("[")

    def process_item(self, item, spider):
        record = ItemAdapter(item).asdict()
        if not self.first:
            self.file.write(",\n")
        self.first = False
        self.file.write(json.dumps(record, ensure_ascii=False, default=str))
        return item

    def close_spider(self, spider):
        self.file.write("]")
        self.file.close()
