from __future__ import annotations

import warnings


warnings.filterwarnings(
    "ignore",
    message=r"The NumPy module was reloaded.*",
    category=UserWarning,
    module=r"lancedb\.common",
)
