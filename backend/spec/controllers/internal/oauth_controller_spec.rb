# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::OauthController, type: :controller do
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
  let(:email) { "test@example.com" }

  describe "POST #create" do
    context "with missing email parameter" do
      it "returns bad request" do
        post :create, params: { token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "with empty email parameter" do
      it "returns bad request" do
        post :create, params: { email: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "when user exists" do
      let!(:existing_user) { create(:user, email: email) }

      it "logs in successfully and returns JWT" do
        post :create, params: { email: email, token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["id"]).to eq(existing_user.id)
        expect(json_response["user"]["email"]).to eq(existing_user.email)
        expect(json_response["user"]["name"]).to eq(existing_user.name)
        expect(json_response["user"]["legal_name"]).to eq(existing_user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(existing_user.preferred_name)

        existing_user.reload
        expect(existing_user.current_sign_in_at).to be_present
      end

      it "updates current_sign_in_at timestamp" do
        freeze_time do
          post :create, params: { email: email, token: api_token }

          existing_user.reload
          expect(existing_user.current_sign_in_at).to eq(Time.current)
        end
      end
    end

    context "when user does not exist" do
      it "registers successfully and returns JWT" do
        expect do
          post :create, params: { email: email, token: api_token }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(1)
          .and change(CompanyAdministrator, :count).by(1)

        expect(response).to have_http_status(:created)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)

        new_user = User.find_by(email: email)
        expect(new_user).to be_present
        expect(new_user.confirmed_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present
        expect(new_user.current_sign_in_at).to be_present
        expect(new_user.tos_agreements).to exist
        expect(new_user.companies).to exist
      end

      it "creates a TOS agreement with IP address" do
        post :create, params: { email: email, token: api_token }

        new_user = User.find_by(email: email)
        tos_agreement = new_user.tos_agreements.first
        expect(tos_agreement.ip_address).to eq(request.remote_ip)
      end

      it "creates a default company with correct attributes" do
        post :create, params: { email: email, token: api_token }

        new_user = User.find_by(email: email)
        company = new_user.companies.first
        expect(company.email).to eq(email)
        expect(company.country_code).to eq("US")
        expect(company.default_currency).to eq("USD")
      end
    end

    context "when user does not exist with invitation token" do
      let!(:company) { create(:company) }
      let!(:invite_link) { create(:company_invite_link, company: company) }

      it "registers successfully with invitation and returns JWT" do
        expect do
          post :create, params: {
            email: email,
            invitation_token: invite_link.token,
            token: api_token,
          }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(0)
          .and change(CompanyAdministrator, :count).by(0)

        expect(response).to have_http_status(:created)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)

        new_user = User.find_by(email: email)
        expect(new_user).to be_present
        expect(new_user.confirmed_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present
        expect(new_user.current_sign_in_at).to be_present
        expect(new_user.signup_invite_link).to eq(invite_link)
        expect(new_user.tos_agreements).to exist
        expect(new_user.companies).to be_empty
      end

      it "does not create a new company when using invitation" do
        company_count_before = Company.count

        post :create, params: {
          email: email,
          invitation_token: invite_link.token,
          token: api_token,
        }

        expect(Company.count).to eq(company_count_before)
      end
    end

    context "when user creation fails" do
      before do
        user = User.new(email: "invalid-email")
        user.errors.add(:email, "is invalid")
        allow_any_instance_of(User).to receive(:save!).and_raise(
          ActiveRecord::RecordInvalid.new(user)
        )
      end

      it "returns unprocessable entity with error message" do
        post :create, params: { email: "invalid@example.com", token: api_token }

        expect(response).to have_http_status(:unprocessable_entity)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is invalid")
      end
    end
  end
end
