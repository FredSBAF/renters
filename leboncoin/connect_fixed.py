#pip install selenium webdriver-manager

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager
from urllib.parse import urljoin
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Initialiser le navigateur
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

service = Service(ChromeDriverManager().install())
ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.176 Safari/537.36"

#pip install selenium undetected-chromedriver

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import undetected_chromedriver as uc
from urllib.parse import urljoin
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.176 Safari/537.36"

options = uc.ChromeOptions()
options.add_argument(f"--user-agent={ua}")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option("useAutomationExtension", False)
options.add_argument("--start-maximized")
# options.add_argument("--user-data-dir=/path/to/your/chrome/profile")  # optional: reuse real profile
# options.add_argument("--profile-directory=Default")

driver = uc.Chrome(options=options)
print("Navigateur démarré.")

# Apply CDP overrides early to reduce detection (best-effort)
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
    # non-fatal if CDP commands are not supported
    pass
password_field.send_keys("5_Uhf-MA5xRiKyk!")

print("Submitting login form...")
# Click on the connection button using data-testid
login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="submitButton"]')))
login_button.click()

# Attendre que la boîte de réception charge
wait.until(EC.url_contains("/messages"))
print("Accéder à la boîte de réception...")
# ensure on messages page
driver.get("https://www.leboncoin.fr/messages")

scroller = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test-id="scroller"], [data-testid="scroller"]')))
urls = []
for li in scroller.find_elements(By.CSS_SELECTOR, 'li'):
    print("Processing a message item...")
    try:
        a = li.find_element(By.CSS_SELECTOR, 'a[href]')
        href = a.get_attribute('href')
        if href:
            urls.append(urljoin(driver.current_url, href))
    except Exception:
        pass

print(urls)
