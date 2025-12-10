#!/usr/bin/env python3
# Requires: pip install selenium undetected-chromedriver certifi

import os
try:
    import certifi
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
except Exception:
    # certifi not available; user should install it in the venv
    pass

import time
from urllib.parse import urljoin
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import undetected_chromedriver as uc


ua = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.176 Safari/537.36"
)

options = uc.ChromeOptions()
options.add_argument(f"--user-agent={ua}")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--start-maximized")
# options.add_argument("--user-data-dir=/path/to/your/chrome/profile")  # optional

driver = uc.Chrome(options=options, version_main=142)
print("Navigateur démarré.")

# Best-effort JS overrides before any page loads
try:
    driver.execute_cdp_cmd("Network.setUserAgentOverride", {"userAgent": ua})
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
// Pass the webdriver check
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
// Mock chrome runtime
window.navigator.chrome = {runtime: {}};
// Languages
Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
// Plugins
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
"""
    })
except Exception:
    pass


# Open login page
driver.get("https://auth.leboncoin.fr/login/")
wait = WebDriverWait(driver, 20)

print("Waiting for email field...")
email_field = wait.until(EC.visibility_of_element_located((By.ID, "email")))
email_field.send_keys("contact@sbimmo-sci.com")

login_button = wait.until(
    EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="login-continue-button"]'))
)
login_button.click()

print("Waiting for password field...")
password_field = wait.until(EC.visibility_of_element_located((By.ID, "password")))
password_field.send_keys("5_Uhf-MA5xRiKyk!")

submit_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="submitButton"]')))
submit_btn.click()

# Wait for messages page to appear (best-effort)
try:
    wait.until(EC.url_contains("/messages"))
except Exception:
    # fallback: small sleep then navigate
    time.sleep(5)

driver.get("https://www.leboncoin.fr/messages")

# Extract message links from scroller
scroller = wait.until(
    EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test-id="scroller"], [data-testid="scroller"]'))
)
urls = []
for li in scroller.find_elements(By.CSS_SELECTOR, "li"):
    try:
        a = li.find_element(By.CSS_SELECTOR, "a[href]")
        href = a.get_attribute("href")
        if href:
            urls.append(urljoin(driver.current_url, href))
    except Exception:
        continue

print(urls)
