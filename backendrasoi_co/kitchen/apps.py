from django.apps import AppConfig


class KitchenConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kitchen'
    verbose_name = 'Rasoi & Co. Store'

    def ready(self):
        from . import signals  # noqa: F401
