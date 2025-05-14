import logging
from typing import List
import google.generativeai as genai
from openai import OpenAI
from fastapi import HTTPException

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class AITopicProcessor:
    def __init__(self):
        self.openai_client = None
        self.gemini_client = None

    def initialize_client(self, model: str, api_key: str):
        if model.startswith("gpt"):
            self.openai_client = OpenAI(api_key=api_key)
        elif model.startswith("gemini"):
            genai.configure(api_key=api_key)
            self.gemini_client = genai.GenerativeModel(model)

    async def process_with_openai(
        self, prompt: str, topics: List[str], model: str
    ) -> List[str]:
        try:
            full_prompt = f"""Current topics: {", ".join(topics)}

{prompt}

Please provide suggestions as a simple list, one per line. Keep each suggestion concise."""

            response = self.openai_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.7,
                max_tokens=500,
            )

            suggestions = response.choices[0].message.content.strip().split("\n")
            # Clean up suggestions (remove bullet points, numbers, etc.)
            suggestions = [
                s.lstrip("- ").lstrip("* ").lstrip("1234567890. ") for s in suggestions
            ]
            return [s for s in suggestions if s]  # Remove empty strings

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

    async def process_with_gemini(self, prompt: str, topics: List[str]) -> List[str]:
        try:
            full_prompt = f"""Current topics: {", ".join(topics)}

{prompt}

Please provide suggestions as a simple list, one per line. Keep each suggestion concise."""

            response = self.gemini_client.generate_content(full_prompt)

            if response.text:
                suggestions = response.text.strip().split("\n")
                # Clean up suggestions (remove bullet points, numbers, etc.)
                suggestions = [
                    s.lstrip("- ").lstrip("* ").lstrip("1234567890. ")
                    for s in suggestions
                ]
                return [s for s in suggestions if s]  # Remove empty strings
            return []

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

    async def process_topics(
        self, model: str, api_key: str, prompt: str, topics: List[str]
    ) -> List[str]:
        """
        Process topics using the specified AI model and return suggestions.
        """
        # Enhanced debug logging
        logger.debug("\n=== Incoming Request Validation ===")
        logger.debug(f"Model: {model if model else 'NOT PROVIDED'}")
        logger.debug(f"API Key: {'[PROVIDED]' if api_key else 'NOT PROVIDED'}")
        logger.debug(f"Prompt: {prompt if prompt else 'NOT PROVIDED'}")
        logger.debug(f"Topics: {topics if topics else 'NOT PROVIDED'}")
        logger.debug(f"Topics length: {len(topics) if topics else 0}")
        logger.debug("Request data types:")
        logger.debug(f"- Model type: {type(model)}")
        logger.debug(f"- API Key type: {type(api_key)}")
        logger.debug(f"- Prompt type: {type(prompt)}")
        logger.debug(f"- Topics type: {type(topics)}")
        logger.debug("=" * 50)

        # More detailed input validation
        validation_errors = []
        if not model or not isinstance(model, str):
            validation_errors.append("Invalid or missing model")
        if not api_key or not isinstance(api_key, str):
            validation_errors.append("Invalid or missing API key")
        if not isinstance(topics, list):
            validation_errors.append("Topics must be a list")
        elif len(topics) == 0:
            validation_errors.append("Topics list cannot be empty")
        if not prompt or not isinstance(prompt, str):
            validation_errors.append("Invalid or missing prompt")

        if validation_errors:
            error_message = "; ".join(validation_errors)
            logger.error(f"Validation failed: {error_message}")
            raise HTTPException(status_code=400, detail=error_message)

        try:
            # Initialize the appropriate client
            self.initialize_client(model, api_key)

            # Validate client initialization
            if model.startswith("gpt") and not self.openai_client:
                raise HTTPException(
                    status_code=500, detail="Failed to initialize OpenAI client"
                )
            if model.startswith("gemini") and not self.gemini_client:
                raise HTTPException(
                    status_code=500, detail="Failed to initialize Gemini client"
                )

            # Process with appropriate model
            if model.startswith("gpt"):
                return await self.process_with_openai(prompt, topics, model)
            elif model.startswith("gemini"):
                return await self.process_with_gemini(prompt, topics)
            else:
                raise HTTPException(
                    status_code=400, detail=f"Unsupported model: {model}"
                )

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
