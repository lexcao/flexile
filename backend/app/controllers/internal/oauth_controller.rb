# frozen_string_literal: true

class Internal::OauthController < Internal::BaseController
  include UserDataSerialization, JwtAuthenticatable

  skip_before_action :verify_authenticity_token

  def create
    email = params[:email]
    return unless validate_params(email)

    user = User.find_by(email: email)

    if user
      user.update!(current_sign_in_at: Time.current)
      success_response_with_jwt(user)
      return
    end

    user = signup(User.new({
      email: email,
      signup_invite_link: invite_link,
      current_sign_in_at: Time.current,
    }))

    success_response_with_jwt(user, :created)
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  private
    def validate_params(email)
      if email.blank?
        render json: { error: "Email is required" }, status: :bad_request
        return false
      end

      true
    end

    def invite_link
      invitation_token = params[:invitation_token]
      if invitation_token.present?
        CompanyInviteLink.find_by(token: invitation_token)
      end
    end

    def signup(user)
      ApplicationRecord.transaction do
        user.confirmed_at = Time.current
        user.invitation_accepted_at = Time.current
        user.save!

        user.tos_agreements.create!(ip_address: request.remote_ip)

        unless user.signup_invite_link
          company = Company.create!(
            email: user.email,
            country_code: "US",
            default_currency: "USD"
          )
          user.company_administrators.create!(company: company)
        end

        user
      end
    end
end
