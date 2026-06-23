class JusteRecruteMoiError(Exception):
    """Base class for domain-level errors."""


class LeadNotFoundError(JusteRecruteMoiError):
    pass


class ProfileNotFoundError(JusteRecruteMoiError):
    pass


class IngestionError(JusteRecruteMoiError):
    pass


class ScoringError(JusteRecruteMoiError):
    pass


class GenerationError(JusteRecruteMoiError):
    pass


class DiscoveryError(JusteRecruteMoiError):
    pass


class ConfigurationError(JusteRecruteMoiError):
    pass

