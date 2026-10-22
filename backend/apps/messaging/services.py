import json
from dataclasses import dataclass

from django.conf import settings

from apps.interactions.models import Interaction
from apps.memories.models import Memory


@dataclass
class GeneratedDraft:
    body: str
    provider: str
    context: dict


def build_context(contact, include_history=True):
    memories = list(
        Memory.objects.filter(contact=contact, allow_drafting=True)
        .order_by("created_at")
        .values("id", "category", "content")
    )
    interactions = []
    if include_history:
        interactions = list(
            Interaction.objects.filter(contact=contact, use_for_drafting=True)
            .order_by("-occurred_at")
            .values("id", "kind", "occurred_at", "notes")[:10]
        )
    return {
        "contact": {
            "id": str(contact.id),
            "name": contact.name,
            "relationship": contact.relationship,
        },
        "memories": [{**item, "id": str(item["id"])} for item in memories],
        "interactions": [
            {
                **item,
                "id": str(item["id"]),
                "occurred_at": item["occurred_at"].isoformat(),
            }
            for item in interactions
        ],
    }


def _template_draft(context, purpose, tone, length, instruction):
    name = context["contact"]["name"]
    detail = ""
    remembered = [item["content"].rstrip(".") for item in context["memories"]]
    if len(remembered) == 1:
        detail = f" I was thinking about {remembered[0]}."
    elif remembered:
        detail = (
            f" I was thinking about {', '.join(remembered[:-1])} and {remembered[-1]}."
        )
    purpose_text = {
        "birthday": "Happy birthday!",
        "congratulations": "Congratulations!",
        "gratitude": "I wanted to say thank you.",
        "reconnect": "It has been a while, and I would love to reconnect.",
    }.get(purpose, "I wanted to check in and see how you are doing.")
    ending = (
        " Hope all is well!" if length == "short" else " I would love to hear how things are going."
    )
    return f"Hi {name}, {purpose_text}{detail}{ending}".strip()


def generate_draft(contact, purpose, tone, length, instruction="", include_history=True):
    context = build_context(contact, include_history)
    fallback = _template_draft(context, purpose, tone, length, instruction)
    if not settings.OPENAI_API_KEY:
        return GeneratedDraft(fallback, "template", context)

    from openai import OpenAI

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
        timeout=15,
        max_retries=1,
    )
    system = (
        "Draft a personal outreach message using only facts in the supplied context. "
        "Never invent events, interests, history, or personal details. If context is sparse, "
        "write a natural generic message. Return only the message body."
    )
    prompt = {
        "purpose": purpose,
        "tone": tone,
        "length": length,
        "instruction": instruction,
        "context": context,
    }
    try:
        response = client.responses.create(
            model=settings.OPENAI_MODEL,
            instructions=system,
            input=json.dumps(prompt),
        )
        body = response.output_text.strip()
        if body:
            return GeneratedDraft(body, "openai-compatible", context)
    except Exception:  # Provider outage must not block the core workflow.
        pass
    return GeneratedDraft(fallback, "template-fallback", context)
