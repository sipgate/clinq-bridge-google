import { Contact, ContactTemplate, ContactUpdate, PhoneNumber } from "@clinq/bridge";
import { people_v1 as People } from "googleapis";
import { ContactName } from "./contact-name.model";

export function convertGooglePersonToContact(connection: People.Schema$Person): Contact | null {
	const id = getGoogleContactId(connection);
	const contactName = getGoogleContactName(connection);
	const company = getGoogleContactCompany(connection);
	const contactUrl = id ? `https://www.google.com/contacts/u/0/#contact/${id}` : null;
	const email = getGoogleContactPrimaryEmailAddress(connection);
	const phoneNumbers = getGoogleContactPhoneNumbers(connection);
	const avatarUrl = getGoogleContactPhoto(connection);

	if (id && phoneNumbers && phoneNumbers.length > 0) {
		return {
			id,
			name: null,
			firstName: contactName ? contactName.firstName : null,
			lastName: contactName ? contactName.lastName : null,
			email,
			company,
			contactUrl,
			avatarUrl,
			phoneNumbers
		};
	}
	return null;
}

export function convertContactToGooglePerson(
	contact: ContactUpdate | ContactTemplate
): People.Schema$Person {
	const person: People.Schema$Person = {};

	const name: People.Schema$Name = {};
	if (contact.firstName) {
		name.givenName = contact.firstName;
	}
	if (contact.lastName) {
		name.familyName = contact.lastName;
	}
	person.names = [name];

	if (contact.email) {
		person.emailAddresses = [{ value: contact.email }];
	}

	person.phoneNumbers = contact.phoneNumbers.map(
		(entry): People.Schema$PhoneNumber => {
			const phoneNumber: People.Schema$PhoneNumber = {
				value: entry.phoneNumber
			};
			if (entry.label) {
				phoneNumber.type = entry.label;
			}
			return phoneNumber;
		}
	);

	return person;
}

function getGoogleContactId(connection: People.Schema$Person): string | null {
	const { resourceName } = connection;
	if (!resourceName) {
		return null;
	}
	const parts = resourceName.split("/");
	const id = parts[1];
	if (!id) {
		return null;
	}

	return id;
}

function getGoogleContactName(connection: People.Schema$Person): ContactName | null {
	if (!connection.names) {
		return null;
	}
	const [name] = connection.names;
	if (!name) {
		return null;
	}
	return {
		firstName: name.givenName || null,
		lastName: name.familyName || null
	};
}

function getGoogleContactCompany(connection: People.Schema$Person): string | null {
	if (!connection.organizations) {
		return null;
	}
	const [company] = connection.organizations;
	if (!company) {
		return null;
	}
	return company.name || null;
}

function getGoogleContactPhoneNumbers(connection: People.Schema$Person): PhoneNumber[] | null {
	if (!connection.phoneNumbers) {
		return null;
	}
	const phoneNumbers: PhoneNumber[] = [];
	for (const phoneNumber of connection.phoneNumbers) {
		if (phoneNumber.value) {
			phoneNumbers.push({
				label: phoneNumber.formattedType || null,
				phoneNumber: phoneNumber.value
			});
		}
	}
	if (phoneNumbers.length < 1) {
		return null;
	}
	return phoneNumbers;
}

function getGoogleContactPrimaryEmailAddress(connection: People.Schema$Person): string | null {
	const { emailAddresses } = connection;
	if (!emailAddresses) {
		return null;
	}
	const primaryEmailAddress = emailAddresses.find(entry =>
		Boolean(entry.metadata && entry.metadata.primary)
	);
	if (!primaryEmailAddress) {
		return null;
	}
	return primaryEmailAddress.value || null;
}

function getGoogleContactPhoto(connection: People.Schema$Person): string | null {
	const { photos } = connection;
	if (!photos) {
		return null;
	}

	const photo = photos.find(entry => Boolean(entry.metadata && entry.metadata.primary));
	if (!photo) {
		return null;
	}

	return photo.url || null;
}
