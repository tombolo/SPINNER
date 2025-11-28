import React, { useEffect } from 'react';
import classNames from 'classnames';
import { Field, Form, Formik } from 'formik';
import { config, save_types } from '@deriv/bot-skeleton';
import { Button, Icon, Input, MobileFullPageModal, Modal, Text, ThemedScrollbars } from '@deriv/components';
import { observer, useStore } from '@deriv/stores';
import { localize } from '@deriv/translations';
import { useDBotStore } from '../../../../stores/useDBotStore';
import IconRadio from './icon-radio';
import './save-modal.scss';

type TSaveModalForm = {
    bot_name: string;
    button_status: number;
    google_drive_connected?: boolean;
    is_authorised: boolean;
    is_mobile?: boolean;
    is_onscreen_keyboard_active?: boolean;
    is_save_modal_open?: boolean;
    icon?: string;
    text?: string;
    onDriveConnect?: () => void;
    onConfirmSave: (values: { is_local: boolean; save_as_collection: boolean; bot_name: string }) => void;
    setCurrentFocus: (current_focus: string) => void;
    toggleSaveModal: () => void;
    validateBotName: (values: string) => { [key: string]: string };
};

const SaveModalForm: React.FC<TSaveModalForm> = ({
    bot_name,
    button_status,
    is_authorised,
    onConfirmSave,
    onDriveConnect,
    validateBotName,
    toggleSaveModal,
    is_mobile,
    is_onscreen_keyboard_active,
    setCurrentFocus,
}) => (
    <Formik
        initialValues={{
            is_local: false, // Always set to false to force Google Drive
            save_as_collection: false,
            bot_name: bot_name === config.default_file_name ? '' : bot_name,
        }}
        validate={validateBotName}
        onSubmit={onConfirmSave}
    >
        {({ values, setFieldValue, touched, errors }) => {
            const content_height = !is_mobile ? '400px' : `calc(100%)`;
            return (
                <ThemedScrollbars height={content_height} autohide>
                    <Form className={classNames({ 'form--active-keyboard': is_onscreen_keyboard_active })}>
                        <div className='modal__content'>
                            <Text size='xs' line_height='l'>
                                {localize(
                                    'Enter your bot name and hit '
                                )}
                                <strong>{localize('Save.')}</strong>
                                <br />
                                <small>{localize('All strategies are saved to Google Drive.')}</small>
                            </Text>
                            <div className='modal__content-row'>
                                <Field name='bot_name'>
                                    {({ field }) => (
                                        <Input
                                            className='save-type__input'
                                            type='text'
                                            placeholder={localize('Untitled Strategy')}
                                            error={touched[field.name] && errors[field.name]}
                                            label={localize('Bot name')}
                                            onFocus={e => setCurrentFocus(e.currentTarget.name)}
                                            onBlur={() => setCurrentFocus(null)}
                                            {...field}
                                        />
                                    )}
                                </Field>
                            </div>
                            <div className='modal__content-row'>
                                <div className='save-type__drive-option'>
                                    <IconRadio
                                        text={'Google Drive'}
                                        icon={<Icon icon={'IcGoogleDrive'} size={48} />}
                                        google_drive_connected={is_authorised}
                                        onDriveConnect={onDriveConnect}
                                    />
                                    {!is_authorised && (
                                        <Text size='xxs' color='less-prominent' className='save-type__drive-hint'>
                                            {localize('Please connect your Google Drive account to save your strategies.')}
                                        </Text>
                                    )}
                                </div>
                            </div>
                            {/* removed this from the save modal popup because it is not there in the design */}
                            {/* <>
                                <Field name='save_as_collection'>
                                    {({ field }) => (
                                        <Checkbox
                                            onChange={() => setFieldValue('save_as_collection', !save_as_collection)}
                                            defaultChecked={save_as_collection}
                                            label={
                                                <Text size='xs' line_height='s' weight='bold'>
                                                    <Localize i18n_default_text='Save as collection' />
                                                </Text>
                                            }
                                            classNameLabel='save-type__checkbox-text'
                                            {...field}
                                        />
                                    )}
                                </Field>
                                <div className='save-type__checkbox-description'>
                                    {localize(
                                        'Enabling this allows you to save your blocks as one collection which can be easily integrated into other bots.'
                                    )}
                                </div>
                            </> */}
                        </div>
                        <div
                            className={classNames('modal__footer', {
                                'modal__footer--active-keyboard': is_onscreen_keyboard_active,
                            })}
                        >
                            <Button
                                type='button'
                                className='modal__footer--button'
                                text={localize('Cancel')}
                                onClick={toggleSaveModal}
                                secondary
                            />
                            <Button
                                className='modal__footer--button'
                                type='submit'
                                is_loading={button_status === 1}
                                is_submit_success={button_status === 2}
                                text={localize('Save')}
                                primary
                            />
                        </div>
                    </Form>
                </ThemedScrollbars>
            );
        }}
    </Formik>
);
const SaveModal = observer(() => {
    const { save_modal, google_drive, dashboard, load_modal } = useDBotStore();
    const { ui } = useStore();
    const { dashboard_strategies } = load_modal;
    const {
        button_status,
        bot_name,
        is_save_modal_open,
        onConfirmSave,
        toggleSaveModal,
        updateBotName,
        validateBotName,
    } = save_modal;
    const { is_authorised, onDriveConnect } = google_drive;
    const { is_onscreen_keyboard_active, setCurrentFocus, is_mobile } = ui;
    const { active_tab } = dashboard;
    
    // Force Google Drive authorization if not already authorized
    useEffect(() => {
        if (is_save_modal_open && !is_authorised) {
            onDriveConnect?.();
        }
    }, [is_save_modal_open, is_authorised, onDriveConnect]);

    useEffect(() => {
        if (active_tab === 1) {
            updateBotName(dashboard_strategies?.[0]?.name ?? '');
        }
    }, [active_tab, dashboard_strategies, updateBotName]);

    return is_mobile ? (
        <MobileFullPageModal
            is_modal_open={is_save_modal_open}
            className='save-modal__wrapper'
            header={localize('Save strategy')}
            onClickClose={toggleSaveModal}
            height_offset='80px'
            page_overlay
        >
            <SaveModalForm
                bot_name={bot_name}
                button_status={button_status}
                is_authorised={is_authorised}
                onConfirmSave={onConfirmSave}
                onDriveConnect={onDriveConnect}
                validateBotName={validateBotName}
                toggleSaveModal={toggleSaveModal}
                is_mobile={is_mobile}
                is_onscreen_keyboard_active={is_onscreen_keyboard_active}
                setCurrentFocus={setCurrentFocus}
            />
        </MobileFullPageModal>
    ) : (
        <Modal
            title={localize('Save strategy')}
            className='modal--save'
            width='32.8rem'
            height='50rem'
            is_open={is_save_modal_open}
            toggleModal={toggleSaveModal}
        >
            <SaveModalForm
                bot_name={bot_name}
                button_status={button_status}
                is_authorised={is_authorised}
                onConfirmSave={onConfirmSave}
                onDriveConnect={onDriveConnect}
                validateBotName={validateBotName}
                toggleSaveModal={toggleSaveModal}
                setCurrentFocus={setCurrentFocus}
            />
        </Modal>
    );
});

export default SaveModal;
