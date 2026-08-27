from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from groq import Groq
from app.core.config import settings
from app.repositories.vendor_repository import VendorRepository
from app.repositories.booking_repository import BookingRepository
from app.repositories.review_repository import ReviewRepository
from app.repositories.favorite_repository import FavoriteRepository
from app.services.vendor_match_service import VendorMatchService, _safe_float
from bson import ObjectId
from bson.errors import InvalidId
import json
import re
import difflib


# covers the logic to differ to  get vendors n bookings , rebiews r fav.
# get vendors edge cases handled

class ChatbotService:
    
    def __init__(
        self,
        vendor_repo: VendorRepository,
        booking_repo: BookingRepository,
        review_repo: ReviewRepository,
        favorite_repo: FavoriteRepository,
        chat_session_repo = None
    ):
        
        self.vendor_repo = vendor_repo
        self.booking_repo = booking_repo
        self.review_repo = review_repo
        self.favorite_repo = favorite_repo
        self.chat_session_repo = chat_session_repo
        self.match_service = VendorMatchService()
        
        self.groq_enabled = bool(settings.GROQ_API_KEY)
        if self.groq_enabled:
            try:
                self.client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                print(f" Failed to initialize Groq client: {e}")
                self.groq_enabled = False
        else:
            print(" GROQ_API_KEY is not configured. Vendor search will work, but general chat will be limited.")
        
        self.vendor_categories = [
            "Photography", "Caterer", "Decorator", "Venue", "Makeup Artist",
            "DJ", "Florist", "Mehndi", "Videography"
        ]

        self.category_synonyms: Dict[str, List[str]] = {
            "Photography": ["photograph", "photographer", "photo shoot", "pics"],
            "Caterer": ["cater", "catering", "food"],
            "Decorator": ["decor", "decoration", "decorate"],
            "Venue": ["venue", "hall", "banquet", "marquee"],
            "Makeup Artist": ["makeup", "mua", "bridal makeup"],
            "DJ": ["dj", "music", "sound system"],
            "Florist": ["florist", "flowers", "flower"],
            "Mehndi": ["mehndi", "henna"],
            "Videography": ["videograph", "videographer", "video"],
        }

        self.pakistani_cities = [
            "karachi", "lahore", "islamabad", "rawalpindi", "faisalabad",
            "multan", "peshawar", "quetta", "sialkot", "gujranwala",
            "kashmir", "hyderabad", "sukkur", "larkana", "nawabshah",
            "abbottabad", "mardan", "swat", "mingora", "kohat",
            "dera ghazi khan", "bahawalpur", "sahiwal", "okara", "sheikhupura",
            "jhang", "sargodha", "rahim yar khan", "gujrat", "sialkot",
            "mirpur", "muzaffarabad", "gilgit", "skardu", "chitral"
        ]

        self.required_fields_order = ["city", "budget", "location", "date", "min_rating"]


        # for groqqq
        self.system_prompt = """You are a helpful wedding planning assistant for PakWedding, a Pakistani wedding platform. 
Your role is to help users find vendors, check their bookings, reviews, and favorites.

For vendor searches:
- Identify the vendor category (Photography, Caterer, Decorator, Venue, Makeup Artist, DJ, Florist, Mehndi, Videography)
- Collect missing information one question at a time: city, budget, preferred location, date/time, minimum rating
- Never ask for information already provided
- Once enough information is collected, use the search_vendors tool
- Always recommend packages that fit the user's budget
- Use real vendor data only - never invent vendors

For user data queries:
- Use get_user_bookings for booking queries
- Use get_user_reviews for review queries  
- Use get_user_favorites for favorites queries
- Only return actual data from the database

Be friendly, professional, and concise. Use Pakistani context when relevant."""
    
    async def chat(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_id: str,
        collected_info: Optional[Dict[str, Any]] = None,
        expected_field: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a chat message and return response.

        collected_info / expected_field should be whatever was returned in
        the *previous* response's "collected_info" / "expected_field" keys.
        The caller (API route) is responsible for round-tripping these back
        in on the next request — that's what lets the assistant correctly
        interpret a bare answer like "150000" as the budget, instead of
        needing the user to say "budget: 150000" every time.
        """

        messages = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        for msg in conversation_history:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        messages.append({"role": "user", "content": message})
        
        intent = self._classify_intent(message, conversation_history)

        if self._is_closing_remark(message):
            cleaned = message.strip().lower().rstrip("!.,")
            if any(g in cleaned for g in ("hi", "hello", "hey")):
                closing_response = "Hello! How can I help you with your wedding planning today?"
            elif any(b in cleaned for b in ("bye", "goodbye", "see you")):
                closing_response = "Goodbye! Best of luck with your wedding preparations. Reach out anytime! 🎉"
            else:
                closing_response = "You're very welcome! 😊 If you'd like more details on any of these vendors or want to explore other options, feel free to ask. Happy planning! ✨"
            result = {
                "response": closing_response,
                "type": "general",
                "collected_info": collected_info or {},
                "expected_field": expected_field
            }

        elif (
            intent == "list_locations"
            and expected_field is not None
            and not re.search(r"\b(?:show|list|what|which|all|available|located)\b", message.lower())
        ):
            result = await self._handle_vendor_search(
                message, user_id, collected_info, expected_field,
                conversation_history=conversation_history
            )

        elif intent == "bookings":
            result = await self._handle_bookings_query(user_id)
        elif intent == "reviews":
            result = await self._handle_reviews_query(user_id)
        elif intent == "favorites":
            result = await self._handle_favorites_query(user_id)
        elif intent == "list_locations":
            result = await self._handle_list_locations(message)
        elif intent == "vendor_search" or collected_info or expected_field:
            result = await self._handle_vendor_search(
                message, user_id, collected_info, expected_field,
                conversation_history=conversation_history
            )
        else:
            # General conversation
            result = await self._general_chat(messages)
        
        # Store chat session if session repo is available
        if self.chat_session_repo:
            try:
                # Add user message and assistant response to conversation history
                updated_history = conversation_history.copy()
                updated_history.append({"role": "user", "content": message})

                assistant_entry: Dict[str, Any] = {
                    "role": "assistant",
                    "content": result.get("response", ""),
                }
                if result.get("vendors"):
                    assistant_entry["vendors"] = self._jsonable(result.get("vendors"))
                if result.get("collected_info"):
                    assistant_entry["collected_info"] = self._jsonable(result.get("collected_info"))
                if result.get("type"):
                    assistant_entry["type"] = result.get("type")

                updated_history.append(assistant_entry)
                
                if session_id:
                    # Update existing session
                    await self.chat_session_repo.update(session_id, updated_history)
                    result["session_id"] = session_id
                else:
                    # Create new session with first message as title
                    title = message[:50] + "..." if len(message) > 50 else message
                    new_session_id = await self.chat_session_repo.create(user_id, title, updated_history)
                    result["session_id"] = new_session_id
            except Exception as e:
                print(f"[CHATBOT] Failed to store chat session: {e}")
        
        return result
    
    def _is_closing_remark(self, message: str) -> bool:
        """True if the whole message is just a thanks/acknowledgement/
        greeting-style remark, with nothing else in it. Deliberately strict
        (whole-message match, not "contains") so it never swallows a real
        answer like "ok, tomorrow" or "thanks, any budget is fine"."""
        cleaned = re.sub(r"[!.,?\s]+$", "", message.strip().lower())
        cleaned = re.sub(r"^[!.,?\s]+", "", cleaned)
        closing_phrases = {
            "thanks", "thank you", "thankyou", "ty", "thx", "tysm",
            "ok", "okay", "k", "cool", "great", "nice", "awesome", "perfect",
            "got it", "sounds good", "alright", "bye", "goodbye", "see you",
            "ok thanks", "okay thanks", "thanks a lot", "thank you so much",
            "appreciate it", "hi", "hello", "hey"
        }
        if cleaned in closing_phrases:
            return True

        # Typo/spacing tolerance (e.g. "than u", "thnku", "thnks") — same
        # fuzzy-matching approach already used elsewhere in this file for
        # cities/categories. Without this, a typo'd thanks like "than u"
        # falls through to vendor_search and gets treated as a new city
        # query instead of an acknowledgement.
        if difflib.get_close_matches(cleaned, closing_phrases, n=1, cutoff=0.75):
            return True

        return False

    def _classify_intent(self, message: str, history: List[Dict[str, str]]) -> str:
        """Classify the user's intent"""
        message_lower = message.lower()

        # Any mention of "city"/"cities" as a standalone word (e.g. "show
        # me cities", "list cities", "what cities", "all cities") is
        # almost always asking for the real locations list, not answering
        # a specific-city question — a legitimate city-name answer like
        # "Lahore" never contains the literal word "city"/"cities". This
        # is intentionally broad because narrower phrasing-specific
        # patterns kept missing real variants and letting them fall
        # through to general LLM chat, which then hallucinated a city
        # list not grounded in the real database at all.
        if re.search(r'\bcit(?:y|ies)\b', message_lower):
            return "list_locations"

        # A bare "in <place>" message (e.g. "in kashmir ?") with nothing
        # else in it is almost always a follow-up asking about vendor
        # availability in that place — but it doesn't contain any
        # category/vendor keyword, so without this check it fell through
        # to general LLM chat, which has no grounding in real data and can
        # hallucinate cities/vendors that don't actually exist in the DB.
        # Routing it into vendor_search instead lets the existing
        # unrecognized-city handling answer from real data.
        if re.fullmatch(r"in\s+[a-zA-Z\s]{3,}\??", message_lower.strip()):
            return "vendor_search"

        for synonyms in self.category_synonyms.values():
            if any(word in message_lower for word in synonyms):
                return "vendor_search"

        all_synonym_words = [w for synonyms in self.category_synonyms.values() for w in synonyms]
        for token in re.findall(r"[a-z]+", message_lower):
            if len(token) < 4:
                continue
            if difflib.get_close_matches(token, all_synonym_words, n=1, cutoff=0.75):
                return "vendor_search"

        # Check for bookings intent
        booking_keywords = ["booking", "booked", "upcoming", "my booking", "reservation"]
        if any(keyword in message_lower for keyword in booking_keywords):
            return "bookings"
        
        # Check for reviews intent
        review_keywords = [
    "my review",
    "my reviews",
    "my rating",
    "my ratings",
    "reviews i wrote",
    "reviews i have written",
    "what did i review"
]
        if any(keyword in message_lower for keyword in review_keywords):
            return "reviews"
        
        favorite_keywords = [
            "favorite", "favorites", "favourite", "favourites",
            "fav", "favs", "saved", "wish list", "wishlist"
        ]
        if any(keyword in message_lower for keyword in favorite_keywords):
            return "favorites"

        vendor_keywords = ["vendor", "find", "search", "looking for", "recommend"]
        if any(keyword in message_lower for keyword in vendor_keywords):
            return "vendor_search"
        
        return "general"
    
    async def _extract_priorities(
        self,
        conversation_history: List[Dict[str, str]],
        current_message: str,
    ) -> Dict[str, float]:
        """
        Use Groq to infer user priority weights from the full conversation.

        Returns a dict with keys: budget, location, rating, availability
        and float values that sum to 1.0.

        Falls back to DEFAULT_PRIORITIES if Groq is unavailable or returns
        unparseable output.  The LLM is explicitly told NOT to invent a
        numerical score — it only determines relative importance weights.
        """
        from app.services.vendor_match_service import DEFAULT_PRIORITIES

        if not self.groq_enabled:
            return dict(DEFAULT_PRIORITIES)

        # Build a compact conversation snapshot (last 10 turns max)
        recent = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
        convo_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in recent
        )
        if current_message:
            convo_text += f"\nUSER: {current_message}"

        prompt = f"""You are analysing a conversation between a user and a wedding vendor assistant.
Your ONLY task is to infer how much each factor matters to THIS user based on what they said.

Conversation:
{convo_text}

Output a JSON object with exactly these four keys and float values that sum to 1.0:
  budget       — how important is staying within budget?
  location     — how important is the city / area / neighbourhood?
  rating       — how important is vendor reputation / reviews / quality?
  availability — how important is the vendor being free on the requested date?

Rules:
- If the user explicitly says budget is critical (e.g. "cannot go above", "strict budget", "very important"), set budget >= 0.40.
- If the user says they don't care about price (e.g. "money is no issue", "best quality only"), set budget <= 0.10.
- If the user mentions a specific area like DHA or Gulberg, location should be >= 0.25.
- If the user emphasises rating/quality/best, set rating >= 0.35.
- If no clear priorities are expressed, use balanced weights: budget=0.35, location=0.25, rating=0.25, availability=0.15.
- Values MUST be between 0.05 and 0.70 each.
- Values MUST sum to exactly 1.0.
- Return ONLY valid JSON, no explanation, no markdown.

Example output:
{{"budget": 0.40, "location": 0.30, "rating": 0.20, "availability": 0.10}}"""

        models = ["llama-3.3-70b-versatile", "groq/compound", "openai/gpt-oss-120b"]
        completion = None
        for m in models:
            try:
                completion = self.client.chat.completions.create(
                    model=m,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,   # low temp for consistent structured output
                    max_tokens=80,
                    stream=False,
                )
                if completion and completion.choices:
                    break
            except Exception:
                continue

        if not completion or not completion.choices:
            return dict(DEFAULT_PRIORITIES)

        try:
            raw = completion.choices[0].message.content.strip()
            # Strip markdown code fences if present
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            parsed = json.loads(raw)

            keys = {"budget", "location", "rating", "availability"}
            if not keys.issubset(parsed.keys()):
                raise ValueError(f"Missing keys in LLM output: {parsed}")

            priorities = {k: float(parsed[k]) for k in keys}

            # ── Weight guardrails (10 %–45 % per dimension) ───────────────────
            # The AI can adapt weights to the conversation, but no single factor
            # should dominate.  Without this, a high min_rating like "4.6+"
            # causes rating to reach 67 % and location to collapse to 6 %,
            # making a wrong-city vendor score 94 % — which is misleading.
            WEIGHT_MIN = 0.10   # no dimension < 10 %
            WEIGHT_MAX = 0.45   # no dimension > 45 %
            priorities = {k: max(WEIGHT_MIN, min(WEIGHT_MAX, v)) for k, v in priorities.items()}
            # Re-normalise after clamping so weights still sum to 1.0
            total = sum(priorities.values())
            if total <= 0:
                raise ValueError("All priorities are zero after clamping")
            priorities = {k: v / total for k, v in priorities.items()}
            # ──────────────────────────────────────────────────────────────────

            print(f"[MATCH] AI-inferred priorities (clamped 10-45%): {priorities}")
            return priorities

        except Exception as e:
            print(f"[MATCH] Priority extraction failed ({e}), using defaults")
            return dict(DEFAULT_PRIORITIES)

    async def _handle_vendor_search(
        self,
        message: str,
        user_id: str,
        collected_info: Dict[str, Any],
        expected_field: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Handle vendor search with slot filling."""
        print(f" _handle_vendor_search called with collected_info: {collected_info}, expected_field: {expected_field}")
        print(f" User message: {message}")

        info = dict(collected_info) if collected_info else {
            "category": None, "city": [], "budget": None,
            "location": None, "date": None, "min_rating": None
        }

    
        pending = info.pop("_pending_suggestion", None)
        affirmative = message.strip().lower() in ("yes", "yeah", "yep", "sure", "ok", "okay", "yes please", "do it")
        if pending and expected_field == pending.get("field") and affirmative:
            info[pending["field"]] = pending["value"]
        else:
            self._extract_vendor_info(message, info, expected_field)

        # If this turn's category switch (or explicit "same as before")
        # auto-carried over filters from the previous search, surface
        # that in a short note prepended to whatever we end up replying
        # with below — question, no-results, or results — so the user
        # can see (and correct) what got reused instead of it happening
        # silently.
        auto_reused_fields = info.pop("_auto_reused", None)
        note = self._format_reused_note(auto_reused_fields, info) if auto_reused_fields else ""

        def with_note(result: Dict[str, Any]) -> Dict[str, Any]:
            if note:
                result["response"] = note + result["response"]
            return result

        # An unrecognized city-change attempt (e.g. "in kashmir") was
        # flagged during extraction but deliberately NOT written into
        # info["city"] — handle it now, before falling through to a
        # search that would silently reuse the old city and make it look
        # like the new one was searched.
        unrecognized_city = info.pop("_unrecognized_city_attempt", None)
        if unrecognized_city:
            # This only ever fires when a city was already set and the
            # user's phrasing ("in kashmir") read as an attempt to CHANGE
            # it, not add to it. Without clearing the old city here, the
            # next valid answer (e.g. "in multan") lands on the
            # multi-city-append logic below (meant for "Lahore or
            # Karachi" style answers to a *fresh* city question) and gets
            # appended onto the stale old city instead of replacing it —
            # silently returning results for both cities.
            info["city"] = []
            available = await self._get_available_cities(info.get("category"))
            if available:
                city_list = "\n".join(f"- {c}" for c in available)
                message_text = (
                    f"I couldn't find any vendors in {unrecognized_city}. "
                    f"Currently, vendors are available in:\n{city_list}\n\n"
                    f"Would you like me to search one of these instead?"
                )
            else:
                message_text = (
                    f"I couldn't find any vendors in {unrecognized_city}. "
                    f"Which city would you like to search instead?"
                )
            return with_note({
                "response": message_text,
                "type": "question",
                "collected_info": info,
                "expected_field": "city"
            })

        missing_field = self._get_missing_vendor_info(info)

        if missing_field:
            # If the field we just asked about is still missing, the
            # user's reply didn't validate as an answer to it (e.g. "30 k"
            # answering "which city?") — say so explicitly instead of
            # just repeating the same question verbatim, which reads as
            # if the bot ignored the answer entirely.
            if expected_field == missing_field:
                question = self._generate_invalid_input_question(missing_field)
            else:
                question = self._generate_question_for_missing_info(missing_field, info)
            return with_note({
                "response": question,
                "type": "question",
                "collected_info": info,
                "expected_field": missing_field
            })

        # ── MATCH REPORT: Fetch ALL category candidates (no city/budget/rating/date filter) ──
        # This is intentionally separate from _search_vendors().
        # _search_vendors() applies hard city+budget+rating+date filters which cause every
        # survivor to score ~100%.  For the Match Report we want ALL vendors in the category
        # so that partial matches (wrong city, over-budget, below-rating) appear with reduced
        # scores rather than being silently excluded.
        match_candidates = await self._fetch_match_report_candidates(info)

        if not match_candidates:
            # Nothing in this category at all — fall back to the normal filtered search
            # so we can show a meaningful "no results" diagnostic to the user.
            vendors, diagnostic = await self._search_vendors(info)

            if not vendors:
                if diagnostic and diagnostic.get("suggested_value") is not None:
                    field = diagnostic["stage"]
                    value = diagnostic["suggested_value"]
                    info["_pending_suggestion"] = {"field": field, "value": value}
                    return with_note({
                        "response": diagnostic["message"],
                        "type": "no_results",
                        "collected_info": info,
                        "expected_field": field
                    })

                message_text = diagnostic["message"] if diagnostic else (
                    "I couldn't find any vendors matching your criteria. "
                    "Would you like to adjust your budget, city, or other requirements?"
                )
                return with_note({
                    "response": message_text,
                    "type": "no_results",
                    "collected_info": info,
                    "expected_field": None
                })

            match_candidates = vendors   # use filtered results as fallback

        # ── AI Match Scoring ─────────────────────────────────────────
        # 1. Ask Groq to infer user priorities from the conversation.
        # 2. Let VendorMatchService calculate deterministic scores from
        #    real vendor data against ALL user preferences.
        #    The LLM never invents a score number.
        # Every category candidate is scored — partial matches get lower
        # scores instead of being excluded from the report entirely.
        priorities = await self._extract_priorities(
            conversation_history or [], message
        )
        vendors = self.match_service.score_vendors(match_candidates, info, priorities)
        # ─────────────────────────────────────────────────────────────

        response = self._format_vendor_results(vendors, info)

        return with_note({
            "response": response,
            "type": "vendor_results",
            "vendors": self._jsonable(vendors),
            "collected_info": info,
            "expected_field": None
        })

    async def _fetch_match_report_candidates(
        self, info: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        MATCH REPORT FLOW ONLY — fetch ALL active/approved vendors whose
        service_category matches the user's selected category.

        Intentionally applies NO city, budget, rating, or date filters.
        Every candidate is passed to VendorMatchService.score_vendors() so that
        vendors with partial matches (wrong city, over-budget, below-min-rating)
        appear in the report with *reduced* scores rather than being excluded.

        This is deliberately separate from _search_vendors(), which hard-filters
        on city+budget+rating+date and causes every survivor to score ~100%.
        """
        category = (info.get("category") or "").strip()
        if not category:
            # If no category was specified, fall back to returning nothing
            # so the caller uses _search_vendors() with its normal diagnostics.
            return []

        try:
            candidates = await self.vendor_repo.get_match_report_candidates(
                category, limit=50
            )
            print(
                f"[MATCH REPORT] Fetched {len(candidates)} category-only candidates "
                f"for '{category}' (no city/budget/rating/date filter)"
            )
            return candidates
        except Exception as exc:
            print(f"[MATCH REPORT] candidate fetch failed: {exc}")
            return []

    def _format_reused_note(self, reused_fields: List[str], info: Dict[str, Any]) -> str:
        """Build a short, transparent note describing which filters were
        auto-carried over from a previous search, so reuse never happens
        invisibly. Returns "" if there's nothing meaningful to report."""
        labels = []
        for field in reused_fields:
            if field == "city":
                cities = info.get("city") or []
                if cities:
                    labels.append(f"city: {', '.join(cities)}")
            elif field == "budget":
                budget = info.get("budget")
                if budget:
                    b_val = _safe_float(budget, 0.0)
                    labels.append(f"budget: PKR {b_val:,.0f}")
            elif field == "location":
                loc = info.get("location")
                if loc and loc != "Any":
                    labels.append(f"location: {loc}")
            elif field == "date":
                date = info.get("date")
                if date and date != "Flexible":
                    labels.append(f"date: {date}")
            elif field == "min_rating":
                rating = info.get("min_rating")
                if rating:
                    labels.append(f"min rating: {rating}+")
        if not labels:
            return ""
        return f"(Reusing your previous search filters — {', '.join(labels)}.)\n\n"

    def _extract_vendor_info(
        self,
        message: str,
        info: Dict[str, Any],
        expected_field: Optional[str] = None
    ) -> None:
        """Parse the current user message and update `info` in place."""

        message_lower = message.lower().strip()

        if not info.get("category"):
            new_category = None
            for category, synonyms in self.category_synonyms.items():
                if any(word in message_lower for word in synonyms):
                    new_category = category
                    print(f"[CHATBOT DEBUG] Matched category: {category} from message: {message}")
                    break
            else:
                
                all_synonym_words = [
                    (word, category)
                    for category, synonyms in self.category_synonyms.items()
                    for word in synonyms
                ]
                for token in re.findall(r"[a-z]+", message_lower):
                    if len(token) < 4:
                        continue
                    close = difflib.get_close_matches(
                        token, [w for w, _ in all_synonym_words], n=1, cutoff=0.75
                    )
                    if close:
                        matched_word = close[0]
                        new_category = next(
                            cat for w, cat in all_synonym_words if w == matched_word
                        )
                        print(f"[CHATBOT DEBUG] Fuzzy matched category: {new_category} from token: {token}")
                        break
            
            # If user mentioned a different category, reset collected info
            if new_category and info.get("category") and new_category != info.get("category"):
                print(f"[CHATBOT DEBUG] Category changed from {info.get('category')} to {new_category} - resetting collected info")
                info.clear()
                info["category"] = new_category
            elif new_category and not info.get("category"):
                info["category"] = new_category
        else:
            # Category already set from UI - check if user is trying to change it
            new_category = None
            for category, synonyms in self.category_synonyms.items():
                if any(word in message_lower for word in synonyms):
                    new_category = category
                    break
            
            if new_category and new_category != info.get("category"):
                print(f" Category changed from {info.get('category')} to {new_category} - resetting collected info")
                # Save what was collected for the previous search before
                # wiping it out, so a phrase like "same city" / "with
                # above cities, ratings etc" can reapply it to the new
                # category instead of forcing the user through every
                # question again from scratch.
                last_search = {
                    "city": info.get("city"),
                    "_city_asked": info.get("_city_asked", bool(info.get("city"))),
                    "budget": info.get("budget"),
                    "_budget_asked": info.get("_budget_asked", info.get("budget") is not None),
                    "location": info.get("location"),
                    "_location_asked": info.get("_location_asked", bool(info.get("location"))),
                    "date": info.get("date"),
                    "_date_asked": info.get("_date_asked", bool(info.get("date"))),
                    "min_rating": info.get("min_rating"),
                    "_rating_asked": info.get("_rating_asked", info.get("min_rating") is not None),
                }
                info.clear()
                info["category"] = new_category
                info["_last_search"] = last_search

                # Auto-remember context: by default, silently carry the
                # previous search's filters into the new category instead
                # of forcing the user to retype "same city" / "with above
                # described" every time they switch category mid-
                # conversation (e.g. "now photographer" right after
                # finishing a DJ search should reuse that DJ search's
                # city/budget/date/rating, not re-ask everything). Any
                # field the user ALSO mentions in this same message will
                # still overwrite it below via the normal per-field
                # parsing that runs after this block, so this only fills
                # in what the current message didn't already say.
                asked_flag_names = {
                    "city": "_city_asked", "budget": "_budget_asked",
                    "location": "_location_asked", "date": "_date_asked",
                    "min_rating": "_rating_asked",
                }
                auto_reused = []
                for field, asked_key in asked_flag_names.items():
                    value = last_search.get(field)
                    if value not in (None, [], ""):
                        info[field] = value
                        if last_search.get(asked_key):
                            info[asked_key] = True
                        auto_reused.append(field)
                if auto_reused:
                    info["_auto_reused"] = auto_reused
                    print(f"[CHATBOT DEBUG] Auto-carried over previous search context: {auto_reused}")

                # The pending question this message was originally meant
                # to answer belonged to the OLD category and no longer
                # applies now that the category itself just changed —
                # without this, the per-field parsing below still treats
                # this message as answering that stale question, and its
                # fallback "just capture the whole message" branches
                # (city/location/etc.) end up swallowing a message like
                # "I'm looking for Photography" whole into a field like
                # location.
                expected_field = None

        # --- reuse context from the previous search, if asked ---
        # e.g. "with above cities, ratings etc", "same as before", "use
        # the same filters" after switching to a new category. Checked
        # before the per-field parsing below so a phrase like this doesn't
        # fall through to being stored as a literal (garbage) city name.
        reuse_phrase_hit = bool(re.search(
            r'\b(same|above|previous|last time|earlier|as before|like before)\b', message_lower
        ))
        if not reuse_phrase_hit and info.get("_last_search"):
            # Typo tolerance: "aove budget and cities" (meant "above")
            # was silently missing the exact-word regex above and falling
            # through to be treated as garbage input instead of a reuse
            # request. Fuzzy-match individual tokens against the same
            # keyword set, same approach already used for category/city
            # matching elsewhere in this method.
            reuse_keywords = ["same", "above", "previous", "earlier", "before"]
            for token in re.findall(r"[a-z]+", message_lower):
                if len(token) < 4:
                    continue
                if difflib.get_close_matches(token, reuse_keywords, n=1, cutoff=0.75):
                    reuse_phrase_hit = True
                    break

        if info.get("_last_search") and reuse_phrase_hit:
            snapshot = info.pop("_last_search")
            asked_flag_names = {
                "city": "_city_asked", "budget": "_budget_asked",
                "location": "_location_asked", "date": "_date_asked",
                "min_rating": "_rating_asked",
            }
            reused = []
            for field, asked_key in asked_flag_names.items():
                info[field] = snapshot.get(field)
                if snapshot.get(asked_key):
                    info[asked_key] = True
                if snapshot.get(field) not in (None, [], ""):
                    reused.append(field)
            if reused:
                info["_auto_reused"] = reused
            print(f"[CHATBOT DEBUG] Reused previous search context: {reused}")
            return

        # --- city (supports more than one, e.g. "Lahore or Karachi") ---
        skip_words_city = ("any", "skip", "no preference", "none", "all", "everywhere")
        if expected_field == "city" and message_lower in skip_words_city:
            # User doesn't want to specify city - mark as asked and skip
            info["city"] = []
            info["_city_asked"] = True
            print(f" User said 'any' for city")
        else:
            found_cities = [c.capitalize() for c in self.pakistani_cities if c in message_lower]
            if not found_cities:
                for token in re.findall(r"[a-z]+", message_lower):
                    if len(token) < 4:
                        continue
                    close = difflib.get_close_matches(token, self.pakistani_cities, n=1, cutoff=0.75)
                    if close:
                        found_cities.append(close[0].capitalize())
            if found_cities:
                if expected_field == "city":
                    
                    existing = info.get("city") or []
                    info["city"] = list(dict.fromkeys(existing + found_cities))
                else:
                    
                    info["city"] = list(dict.fromkeys(found_cities))
                print(f"[CHATBOT DEBUG] Found cities: {found_cities}, total cities in info: {info['city']}")
            elif expected_field == "city" and message_lower not in skip_words_city:
                
                looks_like_other_field = (
                    self._parse_amount(message_lower, require_keyword=False) is not None
                    or self._parse_date(message_lower) is not None
                )
                if looks_like_other_field:
                    print(f"[CHATBOT DEBUG] Rejected city input (looks like another field): {message!r}")
                else:
                    info["city"] = list(dict.fromkeys((info.get("city") or []) + [message.strip().title()]))
                    print(f"[CHATBOT DEBUG] Stored unknown city from user: {message.strip().title()}")
            elif expected_field != "city":
                # The city question was already answered, and this message
                # doesn't mention any city we recognize — but if it clearly
                # LOOKS like an attempt to change the city (e.g. "in
                # kashmir"), don't just silently ignore it and re-run the
                # search against the old city. That previously caused
                # "in kashmir" to quietly keep returning Lahore results,
                # since nothing about that message ever touched info["city"].
                city_intent_match = re.search(r'\b(?:in|at|near|from)\s+([a-zA-Z]{3,})\b', message_lower)
                if city_intent_match:
                    candidate = city_intent_match.group(1).title()
                    info["_unrecognized_city_attempt"] = candidate
                    print(f"[CHATBOT DEBUG] Unrecognized city attempt: {candidate}")

        # --- budget ---
        skip_words_budget = ("skip", "any", "no limit", "no budget", "flexible")
        if expected_field == "budget" and message_lower in skip_words_budget:
            info["budget"] = None
            info["_budget_asked"] = True
        else:
            budget_value = self._parse_amount(message_lower)
            if budget_value is not None and budget_value > 0:
                info["budget"] = budget_value
            elif expected_field == "budget":
                fallback = self._parse_amount(message_lower, require_keyword=False)
                if fallback is not None and fallback > 0:
                    # ── Pakistani context: bare small numbers mean LAKH ──────────
                    # When answering the budget question with just "3", "5", "10",
                    # "3.5" etc. (no suffix), users almost always mean lakh
                    # (× 100,000), not literal rupees.  A real PKR amount would be
                    # typed as "300000", "300k", "3 lakh", or "3,00,000".
                    # Threshold: anything ≤ 500 with no k-suffix treated as lakh.
                    has_k_suffix = bool(re.search(r'\d\s*k\b', message_lower))
                    has_lakh = bool(re.search(r'lakh|lac', message_lower))
                    has_full_amount = bool(re.search(r'\d{4,}', message_lower))  # 4+ digit number
                    if (
                        not has_k_suffix
                        and not has_lakh
                        and not has_full_amount
                        and 0 < fallback <= 500
                    ):
                        fallback = fallback * 100000  # treat as lakh
                        print(f"[CHATBOT DEBUG] Interpreted bare number as lakh: original={fallback/100000} → PKR {fallback:,.0f}")
                    info["budget"] = fallback
                else:
                    
                    print(f"[CHATBOT DEBUG] Rejected budget input (not an amount): {message!r}")


        skip_words_location = ("any", "skip", "no", "no preference", "none", "nope", "n/a", "all")
        if expected_field == "location" and message_lower in skip_words_location:
            info["location"] = "Any"
            info["_location_asked"] = True
        else:
            # NOTE: deliberately does NOT include "venue" as a trigger
            # word. "venue" is also a vendor category, so a message like
            # "find me venue in lahore" would otherwise match "venue in
            # lahore" here and silently set location="Lahore" from the
            # *category* sentence — which is what caused the location
            # question to be skipped/mis-filled during Venue searches.
            location_match = re.search(
                r'(?:\blocation\b|\barea\b|\bplace\b)\s*(?:is|:|in)?\s*([a-zA-Z\s]+)', message_lower
            )
            if location_match and location_match.group(1).strip():
                info["location"] = location_match.group(1).strip().title()
            elif expected_field == "location":
                
                looks_like_other_field = (
                    self._parse_amount(message_lower, require_keyword=False) is not None
                    or self._parse_date(message_lower) is not None
                )
                if looks_like_other_field:
                    print(f"[CHATBOT DEBUG] Rejected location input (looks like another field): {message!r}")
                else:
                    info["location"] = message.strip().title()

        skip_words_date = ("any", "skip", "flexible", "not sure", "no date")
        if expected_field == "date" and message_lower in skip_words_date:
            info["date"] = "Flexible"
            info["_date_asked"] = True
        else:
            date_value = self._parse_date(message_lower)
            if date_value:
                info["date"] = date_value
            elif expected_field == "date":
                
                print(f"[CHATBOT DEBUG] Rejected date input (not a recognizable date): {message!r}")

        skip_words_rating = ("any", "skip", "no preference", "no rating")
        if expected_field == "min_rating" and message_lower in skip_words_rating:
            info["min_rating"] = None
            info["_rating_asked"] = True
        else:
            rating_match = (
                re.search(r'(?:rating|rated|stars?)\s*(?:of|:|above|>=|\+)?\s*(\d+(?:\.\d+)?)', message_lower)
                or re.search(r'(\d+(?:\.\d+)?)\s*(?:stars?|\+)', message_lower)
                # "5 rating" / "of 5 rating" / "exact 5 rating" — number
                # comes BEFORE the word "rating"/"rated", not after. The
                # two patterns above only ever matched the number coming
                # after "rating" (or after a star/plus), so a reply like
                # "of 5 rating" silently matched nothing at all and the
                # previously collected rating value never got updated.
                or re.search(r'(\d+(?:\.\d+)?)\s*(?:rating|rated)\b', message_lower)
            )
            if rating_match:
                try:
                    rating = float(rating_match.group(1))
                    if 0 <= rating <= 5:
                        info["min_rating"] = rating
                except ValueError:
                    pass
            elif expected_field == "min_rating":
                
                try:
                    rating = float(message_lower)
                    if 0 <= rating <= 5:
                        info["min_rating"] = rating
                    else:
                        print(f"[CHATBOT DEBUG] Rejected rating input (out of 0-5 range): {message!r}")
                except ValueError:
                    print(f"[CHATBOT DEBUG] Rejected rating input (not a number): {message!r}")

    def _parse_amount(self, text: str, require_keyword: bool = True) -> Optional[float]:
        """Parse a PKR amount, handling 'k' (thousand) and 'lakh' suffixes."""
        
        has_k_suffix = bool(re.search(r'\d\s*k\b', text))
        if require_keyword and not has_k_suffix:
            if not re.search(r'budget|price|cost|rs\.?|pkr|rupees?|lakh|lac', text):
                return None

        lakh_match = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:lakh|lac)', text)
        if lakh_match:
            try:
                return float(lakh_match.group(1).replace(',', '')) * 100000
            except ValueError:
                return None

        amount_match = re.search(r'([\d,]+(?:\.\d+)?)\s*(k)?', text)
        if amount_match and amount_match.group(1):
            try:
                value = float(amount_match.group(1).replace(',', ''))
                if amount_match.group(2):
                    value *= 1000
                return value
            except ValueError:
                return None
        return None

    def _parse_date(self, text: str) -> Optional[str]:
        """Best-effort date parsing — supports day-first and month-first formats."""
        patterns = [
            # ISO / numeric formats — year-first must come before day-first
            # so "2026-08-15" is not mis-parsed as "26-08-15" by the
            # \d{1,2} pattern grabbing the last two digits of the year.
            r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
            # Natural-language dates — day-first must come before month-first
            # so "30 august 2026" is not parsed as "august 20" (the \d{1,2}
            # in the month-first pattern grabs "20" from "2026").
            r'\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?',
            r'(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        for relative_phrase in ("tomorrow", "next month", "next week"):
            if relative_phrase in text:
                return relative_phrase
        return None

    def _get_missing_vendor_info(self, info: Dict[str, Any]) -> Optional[str]:
        """Return the name of the next field to ask about, or None if done."""
        
        if not info.get("city") and not info.get("_city_asked"):
            return "city"
        
        if info.get("budget") is None and not info.get("_budget_asked"):
            return "budget"
        
        if not info.get("location") and not info.get("_location_asked"):
            return "location"
        
        if not info.get("date") and not info.get("_date_asked"):
            return "date"
        
        if info.get("min_rating") is None and not info.get("_rating_asked"):
            return "min_rating"

        return None

    def _generate_question_for_missing_info(
        self,
        missing_field: str,
        collected: Dict[str, Any]
    ) -> str:
        """Generate a question for the next missing field."""

        questions = {
            "city": "Which city (or cities) are you looking for vendors in?",
            "budget": "What's your budget for this? (You can say something like \"150000\" or \"1.5 lakh\", or \"any\" if it's flexible.)",
            "location": "Any specific area or location preference within the city? (Or say \"any\" to skip.)",
            "date": "What's your event date? I'll check vendor availability for that day.",
            "min_rating": "Do you have a minimum rating preference — e.g. 4+? (Or say \"any\".)",
        }
        return questions.get(missing_field, "Could you tell me a bit more about what you're looking for?")

    def _generate_invalid_input_question(self, field: str) -> str:
        """Used when the user's reply to `field` was rejected as not
        actually answering it (e.g. "30 k" for "which city?"), so we
        explain why we're asking again instead of just repeating the
        question verbatim."""
        questions = {
            "city": "I didn't recognize that as a city. Which city (or cities) are you looking for vendors in?",
            "budget": "That doesn't look like a valid budget. Please enter an amount such as 50000, 100k, or 1.5 lakh — or say \"any\".",
            "location": "I didn't recognize that as a location. Please enter an area such as DHA or Gulberg, or say \"any\" to skip.",
            "date": "I couldn't understand that as a date. Please enter something like \"tomorrow\", \"15 August\", or \"15/08/2026\".",
            "min_rating": "I couldn't understand that as a rating. Please enter something like 3+, 4+, or 4.5 — or say \"any\".",
        }
        return questions.get(field, "I couldn't understand that. Could you try again?")
    
    async def _get_available_cities(self, category: Optional[str] = None) -> List[str]:
        """Return the sorted, deduplicated list of known Pakistani cities
        that actually have at least one approved+active vendor, optionally
        restricted to a category. Always a real query against the data —
        never a hardcoded city list — so this stays correct as vendors are
        added, approved, or removed."""
        query = {"is_approved": True, "is_active": True}
        if category:
            query["service_category"] = {"$regex": f"^{re.escape(category.strip())}$", "$options": "i"}

        vendors = await self.vendor_repo.find_many(query, skip=0, limit=500)
        found = set()
        
        for vendor in vendors:
            address = vendor.get("business_address") or ""
            if address:
                address_lower = address.lower()
                # Check for known cities in the address
                for known_city in self.pakistani_cities:
                    if re.search(rf"\b{re.escape(known_city)}\b", address_lower):
                        found.add(known_city.capitalize())
        
        return sorted(found)

    async def _search_vendors(
        self, info: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:

        query = {
            "is_approved": True,
            "is_active": True
        }

        if info.get("category"):
            query["service_category"] = {"$regex": f"^{re.escape(info['category'].strip())}$", "$options": "i"}

        cities = info.get("city") or []

        if cities:
            if len(cities) == 1:
                city = cities[0].strip()
                query["business_address"] = {
                    "$regex": rf"\b{re.escape(city)}\b",
                    "$options": "i"
                }
            else:
                query["$or"] = [
                    {
                        "business_address": {
                            "$regex": rf"\b{re.escape(city.strip())}\b",
                            "$options": "i"
                        }
                    }
                    for city in cities
                ]


        vendors = await self.vendor_repo.find_many(query, skip=0, limit=20)
        
        if vendors:
            print(f"Sample addresses: {[v.get('business_address') for v in vendors[:5]]}")


        if cities and vendors:
            filtered_vendors = []
            for vendor in vendors:
                address = vendor.get("business_address", "").lower()
                
                if any(re.search(rf"\b{re.escape(city.lower())}\b", address) for city in cities):
                    filtered_vendors.append(vendor)
            print(f" After city post-filter: {len(filtered_vendors)} vendor(s)")
            vendors = filtered_vendors

        if not vendors and info.get("category") and not cities:
            fallback_query = {k: v for k, v in query.items() if k != "service_category"}
            vendors = await self.vendor_repo.find_many(fallback_query, skip=0, limit=20)
            if vendors:
                
                query = fallback_query

        if not vendors:

            try:
                all_approved = await self.vendor_repo.find_many({"is_approved": True, "is_active": True}, skip=0, limit=10)
            except Exception as e:
                print(f" diagnostic query failed: {e}")
            
            try:
                category_only_query = {k: v for k, v in query.items() if k != "business_address"}
                sample = await self.vendor_repo.find_many(category_only_query, skip=0, limit=5)
                sample_addresses = [v.get("business_address") for v in sample]
            except Exception as e:
                print(f"diagnostic address sample query failed: {e}")

            city_label = ", ".join(cities) if cities else "your selected city"
            category_label = info.get("category") or ""
            category_text = f"{category_label} " if category_label else ""
            message = f"I couldn't find any approved {category_text}vendors in {city_label}. "
            message += "Would you like me to search all vendors regardless of city, or try a different city?"
            return [], {
                "stage": "category_city",
                "message": message,
                "suggested_value": None
            }

        vendors_before_budget = vendors

        budget_val = info.get("budget")
        budget = _safe_float(budget_val, 0.0) if budget_val is not None else None
        if budget and budget > 0:
            filtered_vendors = []
            for vendor in vendors:
                packages = vendor.get("packages", [])
                affordable = [
                    p for p in packages
                    if 0 < _safe_float(p.get("price"), 0.0) <= budget
                ]
                if affordable:
                    best = max(affordable, key=lambda p: _safe_float(p.get("price"), 0.0))
                    top_tier_price = max((_safe_float(p.get("price"), 0.0) for p in packages), default=0.0)
                    best_copy = dict(best)
                    best_copy["tier"] = "Premium" if _safe_float(best.get("price"), 0.0) == top_tier_price else "Standard"
                    vendor["_recommended_package"] = best_copy
                    filtered_vendors.append(vendor)
            vendors = filtered_vendors

            if not vendors:
                cheapest_per_vendor = [
                    min((_safe_float(p.get("price"), 0.0) for p in v.get("packages", []) if _safe_float(p.get("price"), 0.0) > 0), default=None)
                    for v in vendors_before_budget
                ]
                cheapest_per_vendor = [p for p in cheapest_per_vendor if p is not None and p > 0]
                suggested_budget = min(cheapest_per_vendor) if cheapest_per_vendor else None
                message = f"No vendors have a package within PKR {budget:,.0f}."
                if suggested_budget:
                    message += (
                        f" The lowest-priced matching package I found is "
                        f"PKR {suggested_budget:,.0f} — want me to search with that budget instead?"
                    )
                return [], {
                    "stage": "budget",
                    "message": message,
                    "suggested_value": suggested_budget
                }

        vendors_before_rating = vendors

        if info.get("min_rating") is not None:
            min_rating = _safe_float(info["min_rating"], 0.0)
            vendors = [v for v in vendors if _safe_float(v.get("rating"), 0.0) >= min_rating]

            if not vendors:
                max_rating = max((_safe_float(v.get("rating"), 0.0) for v in vendors_before_rating), default=0.0)
                message = f"No vendors rated {min_rating}+ found within your other criteria."
                if max_rating:
                    message += (
                        f" The highest-rated match I found is {max_rating}/5 — "
                        f"want me to lower the minimum rating to that?"
                    )
                return [], {
                    "stage": "min_rating",
                    "message": message,
                    "suggested_value": max_rating if max_rating else None
                }
            
        event_date = info.get("date")
        if event_date and event_date not in ("Flexible",) and vendors:
            try:
                vendor_ids = [str(v.get("_id")) for v in vendors]
                booked_ids = await self.booking_repo.find_many(
                    {"vendor_id": {"$in": vendor_ids}, "event_date": event_date, "status": "confirmed"},
                    skip=0, limit=len(vendor_ids)
                )
                booked_vendor_ids = {str(b.get("vendor_id")) for b in booked_ids}
                remaining = [v for v in vendors if str(v.get("_id")) not in booked_vendor_ids]

                if not remaining:
                    return [], {
                        "stage": "date",
                        "message": (
                            f"Every vendor matching your other criteria is already booked on {event_date}. "
                            f"Want to try a different date?"
                        ),
                        "suggested_value": None
                    }
                vendors = remaining
            except Exception as e:
                
                print(f" Availability check failed for date={event_date!r}: {e}")

        return vendors, None
    
    def _format_vendor_results(
        self,
        vendors: List[Dict[str, Any]],
        info: Dict[str, Any]
    ) -> str:
        """Format vendor search results including match score."""
        if not vendors:
            cities = info.get("city") or []
            city_str = ", ".join(cities) if isinstance(cities, list) else str(cities)
            category = info.get("category", "vendor")
            if city_str:
                return f"I couldn't find any {category} vendors in {city_str}. Would you like to check another city or adjust your requirements?"
            return f"I couldn't find any {category} vendors matching your criteria. Would you like to adjust your search?"

        response = f"I found {len(vendors)} vendor(s) for you:\n\n"

        for i, vendor in enumerate(vendors[:5], 1):
            name = vendor.get("business_name", "Unknown")
            category = vendor.get("service_category", "Unknown")
            rating = vendor.get("rating", 0)
            location = vendor.get("business_address", "Location not specified")
            match_score = vendor.get("match_score")
            match_reason = vendor.get("match_reason", "")

            response += f"{i}. **{name}** ({category})\n"

            if match_score is not None:
                response += f"   🎯 **{match_score}% Match**\n"
                if match_reason:
                    response += f"   _{match_reason}_\n"

            response += f"   Rating: {rating}/5 ⭐\n"
            response += f"   Location: {location}\n"

            recommended = vendor.get("_recommended_package")
            if recommended:
                pkg_name = recommended.get("name", "Package")
                pkg_price = _safe_float(recommended.get("price", 0), 0.0)
                pkg_desc = recommended.get("description", "")
                tier = recommended.get("tier", "Standard")
                tier_label = "✨ Premium package" if tier == "Premium" else "Recommended package"
                response += f"   {tier_label}: {pkg_name} — PKR {pkg_price:,.0f}\n"
                if pkg_desc:
                    response += f"     {pkg_desc}\n"

            response += "\n"

        if len(vendors) > 5:
            response += f"...and {len(vendors) - 5} more vendors.\n"

        response += "Would you like more details about any of these vendors, or would you like to refine your search?"

        return response

    # string and object conflict was coming 
    
    def _jsonable(self, value: Any) -> Any:
        """Recursively convert a raw MongoDB document (or list of them)
        into plain JSON-serializable values. Booking/review/favorite/vendor
        documents can contain bson.ObjectId and datetime fields, and
        FastAPI's Pydantic response serializer has no built-in support for
        ObjectId — passing one straight into the response body causes a
        PydanticSerializationError and a 500 on the whole request."""
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: self._jsonable(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._jsonable(v) for v in value]
        return value

    def _user_id_query(self, user_id: str) -> Dict[str, Any]:
        try:
            return {"user_id": {"$in": [user_id, ObjectId(user_id)]}}
        except (InvalidId, TypeError):
            return {"user_id": user_id}

    async def _handle_list_locations(self, message: str) -> Dict[str, Any]:
        """Handle 'what cities have venues?' / 'which cities have
        photographers?' style questions. Optionally scoped to a category
        if one is mentioned in the message; otherwise covers all
        categories. Always backed by a real query — see
        _get_available_cities — never a hardcoded list."""
        message_lower = message.lower()
        category = None
        for cat, synonyms in self.category_synonyms.items():
            if any(word in message_lower for word in synonyms):
                category = cat
                break

        cities = await self._get_available_cities(category)

        if not cities:
            category_text = f" for {category}" if category else ""
            return {
                "response": f"I couldn't find any approved vendors{category_text} yet.",
                "type": "list_locations",
                "data": []
            }

        category_text = f"{category} vendors" if category else "Vendors"
        city_list = "\n".join(f"- {c}" for c in cities)
        return {
            "response": f"{category_text} are available in:\n{city_list}",
            "type": "list_locations",
            # "data" is expected to be a list of dicts (same shape as
            # bookings/reviews/favorites/vendors) by the API's ChatResponse
            # model — a plain list of strings failed Pydantic validation
            # and 500'd every single successful response from this handler.
            "data": [{"city": c} for c in cities]
        }

    async def _handle_bookings_query(self, user_id: str) -> Dict[str, Any]:
        """Handle user bookings query"""

        bookings = await self.booking_repo.find_many(self._user_id_query(user_id), skip=0, limit=50)
        print(f"bookings query for user_id={user_id!r}: found {len(bookings)}")
        
        if not bookings:
            return {
                "response": "You don't have any bookings yet. Would you like to browse vendors and make a booking?",
                "type": "bookings",
                "data": []
            }
        
        upcoming = []
        past = []
        now = datetime.utcnow()
        
        for booking in bookings:
            event_date = booking.get("event_date")
            if isinstance(event_date, str):
                try:
                    event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
                except:
                    event_date = now
            
            if event_date >= now:
                upcoming.append(booking)
            else:
                past.append(booking)
        
        response = f"You have {len(bookings)} total booking(s):\n\n"
        
        if upcoming:
            response += f"**Upcoming Bookings ({len(upcoming)}):**\n"
            for booking in upcoming[:5]:
                vendor_id = booking.get("vendor_id", "")
                event_date = booking.get("event_date", "TBD")
                status = booking.get("status", "pending")
                location = booking.get("event_location", "TBD")
                response += f"- Event on {event_date} at {location} (Status: {status})\n"
            response += "\n"
        
        if past:
            response += f"**Past Bookings ({len(past)}):**\n"
            for booking in past[:5]:
                event_date = booking.get("event_date", "TBD")
                status = booking.get("status", "completed")
                response += f"- Event on {event_date} (Status: {status})\n"
        return {
            "response": response,
            "type": "bookings",
            "data": self._jsonable(bookings)
        }

    async def _handle_reviews_query(self, user_id: str) -> Dict[str, Any]:
        """Handle user reviews query"""
        
        reviews = await self.review_repo.find_many(self._user_id_query(user_id), skip=0, limit=50)
        print(f"reviews query for user_id={user_id!r}: found {len(reviews)}")
        
        if not reviews:
            return {
                "response": "You haven't written any reviews yet. After attending an event, you can review your booked vendors!",
                "type": "reviews",
                "data": []
            }
        
        response = f"You have written {len(reviews)} review(s):\n\n"
        
        for review in reviews[:10]:
            vendor_id = review.get("vendor_id", "")
            rating = review.get("rating", 0)
            comment = review.get("comment", "No comment")
            created_at = review.get("created_at", "")
            
            response += f" Rating: {rating}/5 ⭐\n"
            if comment:
                response += f"  Comment: {comment}\n"
            if created_at:
                response += f"  Date: {created_at}\n"
            response += "\n"
        
        return {
            "response": response,
            "type": "reviews",
            "data": self._jsonable(reviews)
        }
    
    async def _handle_favorites_query(self, user_id: str) -> Dict[str, Any]:
        """Handle user favorites query"""
        
        favorites = await self.favorite_repo.find_many(self._user_id_query(user_id), skip=0, limit=50)

        if not favorites:
            return {
                "response": "You don't have any favorite vendors yet. Browse vendors and click the heart icon to save your favorites!",
                "type": "favorites",
                "data": []
            }
        
        vendor_ids = [str(f.get("vendor_id")) for f in favorites if f.get("vendor_id")]
        vendors = []
        
        for vendor_id in vendor_ids:
            try:
                vendor = await self.vendor_repo.get_by_id(vendor_id)
                if vendor:
                    vendors.append(vendor)
            except Exception as e:
                print(f"favorites: failed to load vendor {vendor_id!r}: {e}")
        
        if not vendors:
            return {
                "response": f"You have {len(favorites)} saved favorites, but some vendor details may not be available.",
                "type": "favorites",
                "data": self._jsonable(favorites)
            }
        
        response = f"You have {len(vendors)} favorite vendor(s):\n\n"
        
        for vendor in vendors[:10]:
            name = vendor.get("business_name", "Unknown")
            category = vendor.get("service_category", "Unknown")
            rating = vendor.get("rating", 0)
            response += f"- **{name}** ({category}) - {rating}/5 ⭐\n"
        
        return {
            "response": response,
            "type": "favorites",
            "data": self._jsonable(vendors)
        }
    
    async def _general_chat(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Handle general chat with Groq"""
        
        if not self.groq_enabled:
            return {
                "response": "I can help you with vendor searches, bookings, reviews, and favorites. For vendor search, just tell me what type of vendor you're looking for (e.g., 'photographer', 'caterer', 'mehndi artist'). For your data, ask about 'my bookings', 'my reviews', or 'my favorites'.",
                "type": "general"
            }
        
        models = ["llama-3.3-70b-versatile", "groq/compound", "openai/gpt-oss-120b"]
        completion = None
        last_err = None
        for m in models:
            try:
                completion = self.client.chat.completions.create(
                    model=m,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024,
                    top_p=1,
                    stream=False                
                )
                if completion and completion.choices:
                    break
            except Exception as e:
                last_err = e
                continue

        if completion and completion.choices:
            return {
                "response": completion.choices[0].message.content,
                "type": "general"
            }

        print(f" Groq API error across all models: {last_err}")
        return {
            "response": "I can help you with vendor searches, bookings, reviews, and favorites. For vendor search, just tell me what type of vendor you're looking for (e.g., 'photographer', 'caterer', 'mehndi artist'). For your data, ask about 'my bookings', 'my reviews', or 'my favorites'.",
            "type": "error"
        }