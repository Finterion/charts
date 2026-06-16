"""Optional IPython / Jupyter display helpers.

Two rendering modes are supported:

- **inline** (default) — fully self-contained: a single ``<iframe srcdoc="…">``
  containing the embed app's bundled JS and the spec injected as a JSON
  literal. No network, no local server. The bundled HTML ships in the wheel
  at ``finterion_charts/_static/embed.html`` and is rebuilt by
  ``scripts/build-python-embed-bundle.mjs`` from ``apps/embed``.

- **url** — points an ``<iframe src="…">`` at a hosted embed app
  (``base#spec=<base64url>``). Used when you want to share a single URL or
  iframe a hosted Finterion embed.

Requires the ``jupyter`` extra (just ``IPython``); does not launch any local
server.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from .builder import ChartSpec


_BUNDLED_HTML_RESOURCE = ("_static", "embed.html")
_SPEC_PLACEHOLDER = "/*__FINTERION_SPEC_JSON__*/ null"


def _load_bundled_html() -> str:
    """Read the offline embed HTML shipped in the wheel."""
    from importlib.resources import files

    pkg = files("finterion_charts")
    resource = pkg.joinpath(*_BUNDLED_HTML_RESOURCE)
    try:
        return resource.read_text(encoding="utf-8")
    except (FileNotFoundError, IsADirectoryError) as exc:
        raise FileNotFoundError(
            "finterion_charts/_static/embed.html is missing. "
            "Rebuild the offline bundle from the repo root with:\n"
            "  pnpm --filter @finterion/charts-embed-app build && "
            "node scripts/build-python-embed-bundle.mjs"
        ) from exc


def _inject_spec(html: str, spec_dict: dict[str, Any]) -> str:
    """Inject ``spec_dict`` into the bundled HTML at the JSON placeholder."""
    if _SPEC_PLACEHOLDER not in html:
        raise RuntimeError(
            "bundled embed.html is missing the spec placeholder; "
            "rebuild with scripts/build-python-embed-bundle.mjs"
        )
    spec_json = json.dumps(
        spec_dict, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    # Prevent a `</script>` substring inside any string value from closing
    # the inline script tag.
    spec_json = spec_json.replace("</", "<\\/")
    return html.replace(_SPEC_PLACEHOLDER, spec_json)


def _resolve_spec_dict(spec: "ChartSpec | dict[str, Any]") -> dict[str, Any]:
    from .builder import ChartSpec

    if isinstance(spec, ChartSpec):
        return spec.to_dict()
    if isinstance(spec, dict):
        return spec
    raise TypeError(f"spec must be ChartSpec or dict, got {type(spec).__name__}")


def _import_ipython() -> Any:
    try:
        import IPython.display as ipd  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "display helpers require IPython. "
            "Install with: pip install 'finterion-charts[jupyter]'"
        ) from exc
    return ipd


def _to_css_size(v: int | str) -> str:
    return f"{int(v)}px" if isinstance(v, int) else str(v)


class _InlineChart:
    """Tiny IPython-displayable wrapper around an HTML iframe.

    Returning this instead of ``IPython.display.HTML`` avoids the
    "Consider using IPython.display.IFrame instead" warning that IPython
    emits whenever the HTML payload contains an ``<iframe>`` tag — which
    is precisely the shape we want here (an ``<iframe srcdoc>``).
    """

    __slots__ = ("_html",)

    def __init__(self, html: str) -> None:
        self._html = html

    def _repr_html_(self) -> str:
        return self._html


def display_inline(
    spec: "ChartSpec | dict[str, Any]",
    *,
    width: int | str = "100%",
    height: int | str = 480,
) -> Any:
    """Render the chart inline using the embed bundle shipped in the wheel.

    Returns an object with an ``_repr_html_`` method containing an
    ``<iframe srcdoc="…">``. No network access, no local server, no
    ``EMBED_BASE`` to configure — works in plain Jupyter, JupyterLab, VS Code
    notebooks, and Colab.
    """
    spec_dict = _resolve_spec_dict(spec)
    # Importing IPython is not strictly required here (we only use a custom
    # _repr_html_), but keep the import error path consistent with the
    # url-mode branch so missing-IPython users get a single, uniform message.
    _import_ipython()

    html = _inject_spec(_load_bundled_html(), spec_dict)
    srcdoc = html.replace("&", "&amp;").replace('"', "&quot;")

    iframe = (
        f'<iframe srcdoc="{srcdoc}" '
        f'style="width:{_to_css_size(width)};height:{_to_css_size(height)};'
        'border:0;display:block;background:transparent;" '
        'sandbox="allow-scripts" loading="lazy"></iframe>'
    )
    return _InlineChart(iframe)


def display_spec(
    spec: "ChartSpec | dict[str, Any]",
    *,
    base: str | None = None,
    width: int | str = "100%",
    height: int | str = 480,
    mode: Literal["inline", "url", "auto"] = "auto",
) -> Any:
    """Return an IPython display object for ``spec``.

    Modes:

    - ``"inline"`` — render via the bundled offline HTML (default when no
      ``base`` is given). Self-contained, no network.
    - ``"url"`` — point an ``IFrame`` at ``{base}#spec=<base64url>``. Requires
      ``base``.
    - ``"auto"`` — ``"url"`` when ``base`` is given, otherwise ``"inline"``.
    """
    if mode == "auto":
        mode = "url" if base else "inline"

    if mode == "inline":
        return display_inline(spec, width=width, height=height)

    if mode == "url":
        if not base:
            raise ValueError("mode='url' requires a non-empty `base`")
        ipd = _import_ipython()
        from .builder import ChartSpec
        from .codec import encode_spec

        encoded = spec.encode() if isinstance(spec, ChartSpec) else encode_spec(spec)
        src = f"{base.rstrip('#')}#spec={encoded}"
        return ipd.IFrame(src=src, width=width, height=height)

    raise ValueError(f"unknown mode {mode!r}; expected 'inline', 'url', or 'auto'")


__all__ = ["display_inline", "display_spec"]
