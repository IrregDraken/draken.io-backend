"""Create the first owner and unconfigured restaurant record without inventing live business settings."""
import argparse
import getpass

from app import create_app, db
from app.models import Restaurant, RestaurantSettings, User, UserRole


def main() -> None:
    parser = argparse.ArgumentParser(description='Bootstrap the first THE HAROLD\'S PLACE owner account.')
    parser.add_argument('--email', required=True)
    parser.add_argument('--display-name', required=True)
    parser.add_argument('--password')
    args = parser.parse_args()
    password = args.password or getpass.getpass('Owner password: ')
    if len(password) < 12:
        raise SystemExit('Owner password must contain at least 12 characters.')

    app = create_app()
    with app.app_context():
        if User.query.filter_by(email=args.email.lower()).first():
            raise SystemExit('A user with that email already exists.')
        restaurant = Restaurant.query.first()
        if restaurant is None:
            restaurant = Restaurant(name="THE HAROLD'S PLACE", is_configured=False)
            restaurant.settings = RestaurantSettings(is_open=False, pickup_enabled=False, delivery_enabled=False)
            db.session.add(restaurant)
        owner = User(email=args.email.lower(), display_name=args.display_name.strip(), role=UserRole.OWNER)
        owner.set_password(password)
        db.session.add(owner)
        db.session.commit()
        print('Owner created. Restaurant configuration remains disabled until verified details are entered.')


if __name__ == '__main__':
    main()
