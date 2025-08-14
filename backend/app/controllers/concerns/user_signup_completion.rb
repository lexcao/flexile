# frozen_string_literal: true

module UserSignupCompletion
  extend ActiveSupport::Concern

  private
    def complete_user_signup(user)
      ApplicationRecord.transaction do
        user.confirmed_at = Time.current
        user.current_sign_in_at = Time.current
        user.invitation_accepted_at = Time.current
        user.save!

        user.tos_agreements.create!(ip_address: request.remote_ip)

        user
      end
    end
end
