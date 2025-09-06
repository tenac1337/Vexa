from flask import Flask
from toolOpener import bp

app = Flask(__name__)
app.register_blueprint(bp)

if __name__ == "__main__":
    app.run(port=5005)
