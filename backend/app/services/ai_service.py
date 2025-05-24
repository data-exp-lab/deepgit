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
        self.available_models = None

    def initialize_client(self, model: str, api_key: str):
        if model.startswith("gpt"):
            self.openai_client = OpenAI(api_key=api_key)
        elif model.startswith("gemini"):
            genai.configure(api_key=api_key)
            # List available models
            try:
                models = genai.list_models()
                self.available_models = [m.name for m in models]
                logger.debug(f"Available Gemini models: {self.available_models}")
                
                # Try to use the requested model first, then fall back to gemini-1.5-flash
                requested_model = f"models/{model}"
                if requested_model in self.available_models:
                    logger.debug(f"Using requested Gemini model: {requested_model}")
                    self.gemini_client = genai.GenerativeModel(requested_model)
                else:
                    # Fall back to gemini-1.5-flash
                    fallback_model = "models/gemini-1.5-flash"
                    if fallback_model in self.available_models:
                        logger.debug(f"Requested model not found, using fallback: {fallback_model}")
                        self.gemini_client = genai.GenerativeModel(fallback_model)
                    else:
                        raise HTTPException(status_code=500, detail=f"Neither requested model {requested_model} nor fallback model {fallback_model} found")
            except Exception as e:
                logger.error(f"Error listing Gemini models: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error initializing Gemini: {str(e)}")

    async def process_with_openai(
        self, prompt: str, topics: List[str], model: str, search_term: str
    ) -> List[str]:
        try:
            full_prompt = f"""Search term: {search_term}\nCurrent topics: {', '.join(topics)}\n\n{prompt}\n\nPlease provide suggestions as a simple list, one per line. Keep each suggestion concise."""

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

    async def process_with_gemini(self, prompt: str, topics: List[str], search_term: str) -> List[str]:
        try:
            if not self.gemini_client:
                raise HTTPException(status_code=500, detail="Gemini client not initialized")

            full_prompt = f"""Search term: {search_term}\nCurrent topics: {', '.join(topics)}\n\n{prompt}\n\n Please provide suggestions as a simple list, one per line. Keep each suggestion concise."""

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
            logger.error(f"Gemini API error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

    async def process_topics(
        self, model: str, api_key: str, prompt: str, topics: List[str], search_term: str
    ) -> List[str]:
        """
        Process topics using the specified AI model and return suggestions.
        """
        # Enhanced debug logging
        # logger.debug("\n=== Incoming Request Validation ===")
        # logger.debug(f"Model: {model if model else 'NOT PROVIDED'}")
        # logger.debug(f"API Key: {'[PROVIDED]' if api_key else 'NOT PROVIDED'}")
        # logger.debug(f"Prompt: {prompt if prompt else 'NOT PROVIDED'}")
        # logger.debug(f"Topics: {topics if topics else 'NOT PROVIDED'}")
        # logger.debug(f"Search Term: {search_term if search_term else 'NOT PROVIDED'}")
        # logger.debug(f"Topics length: {len(topics) if topics else 0}")
        # logger.debug("Request data types:")
        # logger.debug(f"- Model type: {type(model)}")
        # logger.debug(f"- API Key type: {type(api_key)}")
        # logger.debug(f"- Prompt type: {type(prompt)}")
        # logger.debug(f"- Topics type: {type(topics)}")
        # logger.debug(f"- Search Term type: {type(search_term)}")
        # logger.debug("=" * 50)

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
        if not search_term or not isinstance(search_term, str):
            validation_errors.append("Invalid or missing search term")

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
                return await self.process_with_openai(prompt, topics, model, search_term)
            elif model.startswith("gemini"):
                return await self.process_with_gemini(prompt, topics, search_term)
            else:
                raise HTTPException(
                    status_code=400, detail=f"Unsupported model: {model}"
                )

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
