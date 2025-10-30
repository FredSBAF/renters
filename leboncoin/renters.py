"""
Leboncoin Message Scraper - Enhanced Stealth Version
Extracts conversations from Leboncoin.fr messaging system
"""

import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import logging
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LeboncoinScraper:
    def __init__(self, email: str = None, password: str = None):
        self.email = email
        self.password = password
        self.base_url = "https://www.leboncoin.fr"
        self.messages_url = f"{self.base_url}/messages"
        
    async def random_delay(self, min_ms: int = 1000, max_ms: int = 3000):
        """Add random delay to simulate human behavior"""
        delay = random.randint(min_ms, max_ms)
        await asyncio.sleep(delay / 1000)
    
    async def wait_for_manual_action(self, page: Page, message: str, timeout: int = 300):
        """Pause and wait for user to perform manual action"""
        logger.warning("=" * 60)
        logger.warning(f"MANUAL ACTION REQUIRED: {message}")
        logger.warning("The browser window will remain open.")
        logger.warning(f"You have {timeout} seconds to complete the action.")
        logger.warning("Press Enter in the terminal when done...")
        logger.warning("=" * 60)
        
        # Wait for user input
        try:
            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, input),
                timeout=timeout
            )
            logger.info("Continuing...")
            await self.random_delay(2000, 4000)
            return True
        except asyncio.TimeoutError:
            logger.error("Timeout waiting for manual action")
            return False
    
    async def check_for_blocks(self, page: Page) -> bool:
        """Check if we've been blocked or need to solve CAPTCHA"""
        content = await page.content()
        url = page.url
        
        # Check for common block indicators
        block_indicators = [
            "bloqué",
            "blocked",
            "captcha",
            "access denied",
            "too many requests",
            "suspicious activity"
        ]
        
        content_lower = content.lower()
        url_lower = url.lower()
        
        for indicator in block_indicators:
            if indicator in content_lower or indicator in url_lower:
                logger.warning(f"Possible block detected: '{indicator}' found")
                return True
        
        return False
    
    async def manual_login(self, page: Page) -> bool:
        """Manual login - user logs in themselves"""
        try:
            logger.info("Opening Leboncoin homepage...")
            await page.goto(self.base_url, wait_until="domcontentloaded")
            await self.random_delay(2000, 3000)
            
            # Let user log in manually
            await self.wait_for_manual_action(
                page, 
                "Please log in to Leboncoin manually in the browser window, then press Enter here."
            )
            
            # Check if we're logged in by looking for account indicators
            current_url = page.url
            logger.info(f"Current URL after login: {current_url}")
            
            # Try to verify login
            account_indicators = [
                'a[href*="account"]',
                'a[href*="mon-compte"]',
                '[data-qa-id="user-menu"]',
                'text=Mon compte'
            ]
            
            logged_in = False
            for selector in account_indicators:
                try:
                    elem = await page.wait_for_selector(selector, timeout=3000)
                    if elem:
                        logged_in = True
                        break
                except:
                    continue
            
            if logged_in or "connexion" not in current_url.lower():
                logger.info("Login appears successful!")
                return True
            else:
                logger.warning("Could not verify login status")
                return True  # Continue anyway, user might be logged in
                
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False
    
    async def navigate_to_messages_safely(self, page: Page) -> bool:
        """Navigate to messages with checks"""
        try:
            logger.info("Navigating to messages page...")
            
            # First, try clicking on messages link if visible
            message_links = [
                'a[href*="messages"]',
                'text=Messages',
                '[data-qa-id="messages"]'
            ]
            
            clicked = False
            for selector in message_links:
                try:
                    await page.click(selector, timeout=3000)
                    clicked = True
                    logger.info(f"Clicked messages link: {selector}")
                    break
                except:
                    continue
            
            if not clicked:
                # Direct navigation as fallback
                await page.goto(self.messages_url, wait_until="domcontentloaded", timeout=30000)
            
            await self.random_delay(3000, 5000)
            
            # Check if blocked
            if await self.check_for_blocks(page):
                logger.error("Block detected after navigating to messages")
                await self.wait_for_manual_action(
                    page,
                    "A block was detected. Please solve any CAPTCHA or wait for the block to clear, then press Enter."
                )
                await self.random_delay(2000, 3000)
            
            # Verify we're on the messages page
            current_url = page.url
            if "message" in current_url.lower():
                logger.info("Successfully on messages page")
                return True
            else:
                logger.warning(f"May not be on messages page. Current URL: {current_url}")
                return False
                
        except Exception as e:
            logger.error(f"Error navigating to messages: {e}")
            
            # Check if it's a block/close
            if "closed" in str(e).lower() or "target" in str(e).lower():
                logger.error("Page was closed or blocked. This usually means anti-bot detection.")
                return False
            
            return False
    
    async def get_conversation_list(self, page: Page) -> list:
        """Get list of all conversations"""
        try:
            conversations = []
            
            # Wait for page to fully load
            await page.wait_for_load_state("domcontentloaded")
            await self.random_delay(3000, 5000)
            
            # Take screenshot for debugging
            await page.screenshot(path="messages_page.png")
            logger.info("Screenshot saved as messages_page.png for debugging")
            
            # Multiple possible selectors for conversation items
            conversation_selectors = [
                'div[data-qa-id="thread"]',
                'a[href*="/messages/"]',
                '[class*="ThreadItem"]',
                '[class*="thread-item"]',
                '[class*="conversation"]',
                'div[role="button"]',
            ]
            
            conversation_elements = []
            for selector in conversation_selectors:
                try:
                    await page.wait_for_selector(selector, timeout=5000)
                    conversation_elements = await page.query_selector_all(selector)
                    if conversation_elements and len(conversation_elements) > 0:
                        logger.info(f"Found {len(conversation_elements)} conversations with selector: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            if not conversation_elements:
                logger.warning("No conversations found with standard selectors")
                logger.info("You may need to manually identify the correct CSS selector")
                
                # Ask user to help identify
                await self.wait_for_manual_action(
                    page,
                    "Could not find conversations automatically. Please check the browser window and press Enter to continue."
                )
                return []
            
            # Extract conversation data
            for idx, elem in enumerate(conversation_elements):
                try:
                    # Get text content
                    text_content = await elem.inner_text()
                    
                    # Get href if it's a link
                    href = await elem.get_attribute('href')
                    
                    conversations.append({
                        'index': idx,
                        'title': text_content.strip()[:200] if text_content else f"Conversation {idx+1}",
                        'href': href,
                        'element': elem
                    })
                    
                except Exception as e:
                    logger.warning(f"Could not extract data from conversation {idx}: {e}")
            
            logger.info(f"Found {len(conversations)} conversations")
            return conversations
            
        except Exception as e:
            logger.error(f"Error getting conversation list: {e}")
            
            # Offer manual intervention
            logger.info("Taking screenshot for debugging...")
            try:
                await page.screenshot(path="error_page.png")
                logger.info("Screenshot saved as error_page.png")
            except:
                pass
            
            return []
    
    async def extract_conversation(self, page: Page, conversation_info: dict) -> dict:
        """Extract all messages from a specific conversation"""
        try:
            idx = conversation_info['index']
            logger.info(f"Extracting conversation {idx + 1}: {conversation_info['title'][:50]}...")
            
            # Navigate to conversation
            if conversation_info.get('href'):
                # Use href if available
                await page.goto(f"{self.base_url}{conversation_info['href']}", wait_until="domcontentloaded")
            else:
                # Click on element
                elem = conversation_info['element']
                await elem.click()
            
            await self.random_delay(3000, 5000)
            
            # Check for blocks
            if await self.check_for_blocks(page):
                logger.warning("Block detected while extracting conversation")
                await self.wait_for_manual_action(page, "Block detected. Please resolve and press Enter.")
            
            # Scroll to load all messages
            await self.scroll_messages(page)
            
            # Take screenshot
            await page.screenshot(path=f"conversation_{idx}.png")
            
            # Extract messages
            messages = await self.extract_messages_from_page(page)
            
            # Extract listing info
            listing_info = await self.extract_listing_info(page)
            
            conversation_data = {
                'title': conversation_info['title'],
                'listing': listing_info,
                'messages': messages,
                'message_count': len(messages),
                'extracted_at': datetime.now().isoformat()
            }
            
            logger.info(f"Extracted {len(messages)} messages")
            return conversation_data
            
        except Exception as e:
            logger.error(f"Error extracting conversation: {e}")
            return {
                'title': conversation_info.get('title', 'Unknown'),
                'error': str(e),
                'messages': []
            }
    
    async def extract_messages_from_page(self, page: Page) -> list:
        """Extract all message elements from current page"""
        messages = []
        
        # Multiple possible message selectors
        message_selectors = [
            '[data-qa-id="message"]',
            '[class*="Message"]',
            '[class*="message"]',
            '[class*="bubble"]',
            'div[role="article"]',
            '[class*="chat-message"]'
        ]
        
        message_elements = []
        for selector in message_selectors:
            try:
                elements = await page.query_selector_all(selector)
                if elements and len(elements) > 0:
                    message_elements = elements
                    logger.info(f"Found {len(elements)} messages with selector: {selector}")
                    break
            except:
                continue
        
        if not message_elements:
            logger.warning("No messages found with standard selectors")
            # Return empty but don't fail
            return []
        
        for msg_elem in message_elements:
            try:
                text = await msg_elem.inner_text()
                
                # Try to extract timestamp
                timestamp = None
                time_selectors = ['time', '[class*="time"]', '[class*="date"]', '[datetime]']
                for ts_sel in time_selectors:
                    try:
                        time_elem = await msg_elem.query_selector(ts_sel)
                        if time_elem:
                            timestamp = await time_elem.inner_text()
                            break
                    except:
                        continue
                
                # Try to determine sender
                class_list = await msg_elem.get_attribute('class') or ''
                is_sent = 'sent' in class_list.lower() or 'own' in class_list.lower() or 'me' in class_list.lower()
                
                if text and text.strip():
                    messages.append({
                        'text': text.strip(),
                        'timestamp': timestamp,
                        'is_sent_by_me': is_sent
                    })
            except Exception as e:
                logger.debug(f"Could not extract message: {e}")
        
        return messages
    
    async def scroll_messages(self, page: Page):
        """Scroll through message history to load all messages"""
        try:
            logger.info("Scrolling to load message history...")
            
            # Try to find scrollable container
            container_selectors = [
                '[class*="message-list"]',
                '[class*="messages"]',
                '[class*="conversation"]',
                'main',
                '[role="main"]'
            ]
            
            for selector in container_selectors:
                try:
                    container = await page.query_selector(selector)
                    if container:
                        # Scroll to top multiple times
                        for i in range(5):
                            await page.evaluate(f'''
                                const el = document.querySelector("{selector}");
                                if (el) {{
                                    el.scrollTop = 0;
                                    el.scrollTo({{ top: 0, behavior: "smooth" }});
                                }}
                            ''')
                            await self.random_delay(1000, 2000)
                        logger.info("Scrolling complete")
                        break
                except Exception as e:
                    logger.debug(f"Could not scroll with selector {selector}: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Could not scroll messages: {e}")
    
    async def extract_listing_info(self, page: Page) -> dict:
        """Extract listing information from the conversation page"""
        listing = {}
        
        try:
            # Try to find listing title
            title_selectors = ['h1', 'h2', '[class*="title"]', '[data-qa-id="ad-title"]']
            for selector in title_selectors:
                try:
                    elem = await page.query_selector(selector)
                    if elem:
                        title = await elem.inner_text()
                        if title and len(title) > 5:  # Reasonable title length
                            listing['title'] = title.strip()
                            break
                except:
                    continue
            
            # Try to find price
            price_selectors = ['[class*="price"]', '[data-qa-id="price"]', '[class*="amount"]']
            for selector in price_selectors:
                try:
                    elem = await page.query_selector(selector)
                    if elem:
                        price = await elem.inner_text()
                        if price and ('€' in price or price.isdigit()):
                            listing['price'] = price.strip()
                            break
                except:
                    continue
            
            # Try to find location
            location_selectors = ['[class*="location"]', '[data-qa-id="location"]']
            for selector in location_selectors:
                try:
                    elem = await page.query_selector(selector)
                    if elem:
                        listing['location'] = (await elem.inner_text()).strip()
                        break
                except:
                    continue
            
        except Exception as e:
            logger.debug(f"Could not extract some listing info: {e}")
        
        return listing
    
    async def scrape_all(self, filter_text: str = None, max_conversations: int = None):
        """Main scraping function with manual intervention support"""
        async with async_playwright() as p:
            # Launch browser with stealth settings
            browser = await p.chromium.launch(
                headless=False,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                locale='fr-FR',
                timezone_id='Europe/Paris',
            )
            
            # Stealth scripts
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                window.chrome = { runtime: {} };
            """)
            
            page = await context.new_page()
            
            try:
                # Manual login
                if not await self.manual_login(page):
                    logger.error("Login failed or cancelled")
                    return None
                
                # Navigate to messages
                if not await self.navigate_to_messages_safely(page):
                    logger.error("Could not access messages page")
                    # Don't abort, let user check manually
                    await self.wait_for_manual_action(
                        page,
                        "Navigation to messages failed. If you can see the messages page, press Enter to continue."
                    )
                
                # Get conversations
                conversations = await self.get_conversation_list(page)
                
                if not conversations:
                    logger.warning("No conversations found")
                    await self.wait_for_manual_action(
                        page,
                        "No conversations detected. Check the browser window. Press Enter to abort."
                    )
                    return []
                
                # Filter if needed
                if filter_text:
                    conversations = [c for c in conversations if filter_text.lower() in c['title'].lower()]
                    logger.info(f"Filtered to {len(conversations)} conversations matching '{filter_text}'")
                
                # Limit if needed
                if max_conversations:
                    conversations = conversations[:max_conversations]
                    logger.info(f"Limited to {max_conversations} conversations")
                
                # Extract each conversation
                results = []
                for idx, conv in enumerate(conversations):
                    logger.info(f"\n{'='*60}")
                    logger.info(f"Processing conversation {idx + 1}/{len(conversations)}")
                    logger.info(f"{'='*60}\n")
                    
                    # Add delay between conversations
                    if idx > 0:
                        delay = random.randint(8000, 15000)
                        logger.info(f"Waiting {delay/1000}s before next conversation...")
                        await self.random_delay(delay, delay + 2000)
                    
                    data = await self.extract_conversation(page, conv)
                    results.append(data)
                    
                    # Return to messages list
                    logger.info("Returning to messages list...")
                    await page.goto(self.messages_url, wait_until="domcontentloaded")
                    await self.random_delay(4000, 6000)
                    
                    # Check for blocks
                    if await self.check_for_blocks(page):
                        logger.warning("Block detected after extracting conversation")
                        await self.wait_for_manual_action(
                            page,
                            "Block detected. Resolve any issues and press Enter to continue, or Ctrl+C to stop."
                        )
                
                logger.info("\n" + "="*60)
                logger.info(f"Scraping complete! Extracted {len(results)} conversations")
                logger.info("="*60)
                
                return results
                
            except KeyboardInterrupt:
                logger.info("Scraping interrupted by user")
                return None
            except Exception as e:
                logger.error(f"Scraping error: {e}")
                import traceback
                traceback.print_exc()
                return None
            finally:
                logger.info("Keeping browser open for 10 seconds...")
                await asyncio.sleep(10)
                await browser.close()
    
    def save_to_json(self, data: list, filename: str = None):
        """Save scraped data to JSON file"""
        if not data:
            logger.warning("No data to save")
            return
        
        if filename is None:
            filename = f"leboncoin_messages_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Data saved to {filename}")
        logger.info(f"Total conversations: {len(data)}")
        total_messages = sum(c.get('message_count', 0) for c in data)
        logger.info(f"Total messages: {total_messages}")


async def main():
    """Example usage"""
    
    # Configuration - Email/password not needed for manual login
    EMAIL = None
    PASSWORD = None
    
    # Optional filters
    FILTER_TEXT = None  # Set to "Studio lumineux" to filter specific conversations
    MAX_CONVERSATIONS = 3  # Start with just 3 to test
    
    # Create scraper
    scraper = LeboncoinScraper(EMAIL, PASSWORD)
    
    # Scrape messages
    logger.info("="*60)
    logger.info("Leboncoin Message Scraper - Manual Mode")
    logger.info("="*60)
    logger.info("This script will open a browser window.")
    logger.info("You will need to log in manually when prompted.")
    logger.info("The script will pause and wait for your input when needed.")
    logger.info("="*60)
    
    results = await scraper.scrape_all(
        filter_text=FILTER_TEXT,
        max_conversations=MAX_CONVERSATIONS
    )
    
    if results:
        # Save to JSON
        scraper.save_to_json(results)
        logger.info("✓ Success!")
    else:
        logger.error("✗ Scraping failed or no data collected")


if __name__ == "__main__":
    asyncio.run(main())