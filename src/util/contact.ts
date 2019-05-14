import { Contact, ContactTemplate, ContactUpdate, PhoneNumber,PhoneNumberLabel } from "@clinq/bridge";
import { people_v1 as People } from "googleapis";
import { ContactName } from "./contact-name.model";
import { GooglePhoneNumberLabel } from "./phonnumber-label.model";

export function convertGooglePersonToContact(connection: People.Schema$Person): Contact | null {
	const id = getGooglePersonResourceId(connection);
	const contactId = getGoogleContactId(connection);
	const contactName = getGoogleContactName(connection);
	const organization = getGoogleContactOrganization(connection);
	const contactUrl = contactId ? `https://contacts.google.com/contact/${contactId}` : null;
	const email = getGoogleContactEmailAddress(connection);
	const phoneNumbers = getGoogleContactPhoneNumbers(connection);
	const avatarUrl = getGoogleContactPhoto(connection);

	if (id) {
		return {
			id,
			name: null,
			firstName: contactName ? contactName.firstName : null,
			lastName: contactName ? contactName.lastName : null,
			email,
			organization,
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

	if (contact.organization) {
		person.organizations = [{ name: contact.organization }];
	}

	person.phoneNumbers = contact.phoneNumbers
		.filter((entry: any) => getGooglePhoneNumberLabel(entry.label))
		.map(
			(entry: any): People.Schema$PhoneNumber => {
				const phoneNumber: People.Schema$PhoneNumber = {
					value: entry.phoneNumber
				};
				const phoneNumberLabel = getGooglePhoneNumberLabel(entry.label);
				if (phoneNumberLabel) {
					phoneNumber.type = phoneNumberLabel;
				}
				return phoneNumber;
			}
		);

	return person;
}

function getGooglePhoneNumberLabel(phoneNumberLabel?: string): string | null {
	switch (phoneNumberLabel) {
		case GooglePhoneNumberLabel.HOME:
			return "home";
		case GooglePhoneNumberLabel.WORK:
			return "work";
		case GooglePhoneNumberLabel.MOBILE:
			return "mobile";
		case GooglePhoneNumberLabel.HOMEFAX:
			return "homeFax";
		case GooglePhoneNumberLabel.WORKFAX:
			return "workFax";
		case GooglePhoneNumberLabel.WORKMOBILE:
			return "workMobile";
		case GooglePhoneNumberLabel.WORKPAGER:
			return "workPager";
		case GooglePhoneNumberLabel.MAIN:
			return "main";
		case GooglePhoneNumberLabel.GOOGLEVOICE:
			return "googleVoice";
		case GooglePhoneNumberLabel.OTHER:
			return "other";
		default:
			return phoneNumberLabel || null;
	}
}

function getGooglePersonResourceId(connection: People.Schema$Person): string | null {
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

function getGoogleContactId(connection: People.Schema$Person): string | null {
	const { metadata } = connection;
	if (!metadata || !metadata.sources) {
		return null;
	}
	const source = metadata.sources.find(entry => entry.type === "CONTACT");
	if (!source) {
		return null;
	}
	return source.id ? source.id : null;
}

function getGoogleContactName(connection: People.Schema$Person): ContactName | null {
	if (!connection.names) {
		return null;
	}
	const name = connection.names.find(entry => isGoogleContactField(entry.metadata));
	if (!name) {
		return null;
	}
	return {
		firstName: name.givenName || null,
		lastName: name.familyName || null
	};
}

function getGoogleContactOrganization(connection: People.Schema$Person): string | null {
	if (!connection.organizations) {
		return null;
	}
	const [organization] = connection.organizations;
	if (!organization) {
		return null;
	}
	return organization.name || null;
}

function getGoogleContactPhoneNumbers(connection: People.Schema$Person): PhoneNumber[] {
	if (!connection.phoneNumbers) {
		return [];
	}

	console.log(JSON.stringify(connection.phoneNumbers, null, 2));
	const phoneNumbers: PhoneNumber[] = [];
	for (const phoneNumber of connection.phoneNumbers) {
		const isContactNumber = isGoogleContactField(phoneNumber.metadata);
		// workaround to allow all provided labels
		const phoneNumberLabel = (getPhoneNumberLabel(phoneNumber.type) as unknown) as PhoneNumberLabel;
		if (isContactNumber && phoneNumber.value && phoneNumberLabel) {
			phoneNumbers.push({
				label: phoneNumberLabel,
				phoneNumber: phoneNumber.value
			});
		}
	}
	return phoneNumbers;
}

function getPhoneNumberLabel(phoneNumberType?: string): GooglePhoneNumberLabel {
	switch (phoneNumberType) {
		case "home":
			return GooglePhoneNumberLabel.HOME;
		case "work":
			return GooglePhoneNumberLabel.WORK;
		case "mobile":
			return GooglePhoneNumberLabel.MOBILE;
		case "homeFax":
			return GooglePhoneNumberLabel.HOMEFAX;
		case "workFax":
			return GooglePhoneNumberLabel.WORKFAX;
		case "workMobile":
			return GooglePhoneNumberLabel.WORKMOBILE;
		case "workPager":
			return GooglePhoneNumberLabel.WORKPAGER;
		case "main":
			return GooglePhoneNumberLabel.MAIN;
		case "googleVoice":
			return GooglePhoneNumberLabel.GOOGLEVOICE;
		case "other":
			return GooglePhoneNumberLabel.OTHER;
		default:
			// hack to allow all labels
			return ((phoneNumberType || GooglePhoneNumberLabel.OTHER) as unknown) as GooglePhoneNumberLabel;
	}
}

function getGoogleContactEmailAddress(connection: People.Schema$Person): string | null {
	const { emailAddresses } = connection;
	if (!emailAddresses) {
		return null;
	}
	const contactEmailAddress = emailAddresses.find(entry => isGoogleContactField(entry.metadata));
	if (!contactEmailAddress) {
		return null;
	}
	return contactEmailAddress.value || null;
}

function getGoogleContactPhoto(connection: People.Schema$Person): string | null {
	const { photos } = connection;
	if (!photos) {
		return null;
	}

	const photo = photos.find(entry => isGoogleContactField(entry.metadata));
	if (!photo) {
		return null;
	}

	return photo.url || null;
}

function isGoogleContactField(metadata?: People.Schema$FieldMetadata): boolean {
	if (!metadata) {
		return false;
	}
	if (!metadata.source) {
		return false;
	}
	if (!metadata.source.type) {
		return false;
	}
	return metadata.source.type === "CONTACT";
}
