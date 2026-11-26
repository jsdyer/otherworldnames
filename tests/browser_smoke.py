"""Exercise the built planetary names tool at a project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "example-tool")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/example-tool/")
                page.wait_for_selector("#workbench:visible")
                assert page.locator("#detail-name").inner_text() == "Canso"
                assert "Nova Scotia" in page.locator("#origin").inner_text()
                assert page.locator("#source-link").get_attribute("href").endswith("/Feature/1006")
                assert "Panama" in page.locator("#shared-records").inner_text()
                page.locator("#shared-name").select_option("Copernicus")
                page.get_by_role("link", name="Locate on Moon").click()
                assert page.locator("#source-link").get_attribute("href").endswith("/Feature/1296")
                page.locator("#query").fill("nowherezzzz")
                assert "0 matching" in page.locator("#matches").inner_text()
                page.locator('[data-example="3691"]').click()
                assert page.locator("#detail-name").inner_text() == "Mare Tranquillitatis"
                page.locator("#satellite").check()
                page.locator("#type").select_option("Satellite Feature")
                assert page.locator("#results button").count() > 0
                page.locator("#next").click()
                page.locator("#results button").first.click()
                name = page.locator("#detail-name").inner_text()
                assert name and "feature=" in page.url
                page.reload()
                page.wait_for_selector("#workbench:visible")
                assert page.locator("#detail-name").inner_text() == name
                page.locator('[data-example="1006"]').click()
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                page.goto(f"http://127.0.0.1:{server.server_port}/example-tool/crater-light/?feature=1296&site=langley&date=2024-03-18")
                page.wait_for_selector("#planner:visible")
                assert page.locator('link[rel="canonical"]').get_attribute('href') == 'https://coolcode.ca/otherworldnames/crater-light/'
                assert page.get_by_role("heading", name="Lunar crater observing planner").count() == 1
                assert page.locator("body").get_attribute("data-tool-id") == "otherworldnames"
                assert page.locator("#headline").inner_text() == "Copernicus"
                assert "crater in darkness" in page.locator("#verdict").inner_text()
                page.locator("#next button").click()
                assert page.locator("#date").input_value() == "2024-03-19"
                assert page.locator("#hours tr.window").count() == 4
                assert "62.7°" in page.locator("#hours tr").nth(3).inner_text()
                page.locator("#site").select_option("halifax")
                assert "67.6°" in page.locator("#hours tr").nth(3).inner_text()
                assert "UTC−03:00" in page.locator("#clock").inner_text()
                page.reload()
                page.wait_for_selector("#planner:visible")
                assert page.locator("#site").input_value() == "halifax"
                assert page.locator("#date").input_value() == "2024-03-19"
                assert page.locator("#weather").is_hidden()
                page.screenshot(path=str(screenshots / "crater-light-mobile.png"), full_page=True)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                page.locator("#feature").select_option("6108")
                assert "beyond the lunar limb" in page.locator("#verdict").inner_text()
                page.locator("#gazetteer").click()
                page.wait_for_selector("#workbench:visible")
                assert page.locator("#detail-name").inner_text() == "Tsiolkovskiy"
                page.locator("#light-link").click()
                page.wait_for_selector("#planner:visible")
                assert page.locator("#feature").input_value() == "6108"
                assert not errors, errors
                browser.close()
            print("Browser checks passed: records, filters, permalinks, pagination and mobile layout")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
