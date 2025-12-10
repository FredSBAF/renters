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
options = Options()
driver = webdriver.Chrome(service=service, options=options)
print("Navigateur démarré.")
# Accéder à la page de connexion de la messagerie
driver.get("https://auth.leboncoin.fr/login/")

# Remplir les champs de connexion
print("Remplissage des champs de connexion...")
    wait = WebDriverWait(driver, 20)
    # wait for the email input to be present and visible
    email_field = wait.until(EC.visibility_of_element_located((By.ID, "email")))
    email_field.send_keys("contact@sbimmo-sci.com")
# Click on the connection button using data-testid
    login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="login-continue-button"]')))
    login_button.click()
    # wait for the password field to appear
print("Filling password field...")
    password_field = wait.until(EC.visibility_of_element_located((By.ID, "password")))
    password_field.send_keys("5_Uhf-MA5xRiKyk!")
print("Submitting login form...")
# Click on the connection button using data-testid
    login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="submitButton"]')))
    login_button.click()

# Attendre que la boîte de réception charge
driver.implicitly_wait(10)
print("Accéder à la boîte de réception...")
driver.get("https://www.leboncoin.fr/messages")



scroller = driver.find_element(By.CSS_SELECTOR, '[data-test-id="scroller"], [data-testid="scroller"]')
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